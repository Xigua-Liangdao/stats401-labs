"""Build the Lab 4 FPL tweet dataset and sentiment-analysis outputs.

The source is the CC0 FPL Tweets Dataset on Kaggle:
https://www.kaggle.com/datasets/prasad22/fpl-tweets-dataset

Run from anywhere with:
    python lab4/clean_tweets.py

For an already-downloaded copy of FPL_tweets.csv:
    python lab4/clean_tweets.py --source /path/to/FPL_tweets.csv
"""

from __future__ import annotations

import argparse
import hashlib
import html
import io
import json
import re
import zipfile
from pathlib import Path

import nltk
import numpy as np
import pandas as pd
import requests
import torch
from nltk.stem import WordNetLemmatizer
from sklearn.feature_extraction.text import ENGLISH_STOP_WORDS, TfidfVectorizer
from transformers import AutoModelForSequenceClassification, AutoTokenizer


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
NLTK_DATA_DIR = ROOT / ".nltk_data"
DATASET_URL = (
    "https://www.kaggle.com/api/v1/datasets/download/"
    "prasad22/fpl-tweets-dataset"
)
MODEL_NAME = "cardiffnlp/twitter-roberta-base-sentiment-latest"
WORDNET_URL = (
    "https://raw.githubusercontent.com/nltk/nltk_data/gh-pages/"
    "packages/corpora/wordnet.zip"
)
RANDOM_SEED = 401
SAMPLE_PER_YEAR = 250
RAW_COLUMNS = [
    "ID",
    "Timestamp",
    "User",
    "Text",
    "Hashtag",
    "Retweets",
    "Likes",
    "Replies",
    "Source",
    "Location",
    "Verified_Account",
    "Followers",
    "Following",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--source",
        type=Path,
        help="Optional local FPL_tweets.csv. Otherwise the CC0 Kaggle ZIP is downloaded.",
    )
    parser.add_argument(
        "--sample-per-year",
        type=int,
        default=SAMPLE_PER_YEAR,
        help="Deterministic sample size for each calendar year (default: 250).",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=32,
        help="RoBERTa inference batch size (default: 32).",
    )
    return parser.parse_args()


def load_source(source: Path | None) -> pd.DataFrame:
    read_options = {"dtype": {"ID": "string"}, "low_memory": False}
    if source:
        if not source.exists():
            raise FileNotFoundError(f"Source CSV not found: {source}")
        print(f"Reading local source: {source}")
        return pd.read_csv(source, **read_options)

    print("Downloading the CC0 FPL Tweets Dataset from Kaggle...")
    response = requests.get(
        DATASET_URL,
        headers={"User-Agent": "STATS401-Lab4/1.0 (educational project)"},
        timeout=(30, 900),
    )
    response.raise_for_status()
    with zipfile.ZipFile(io.BytesIO(response.content)) as archive:
        csv_names = [name for name in archive.namelist() if name.lower().endswith(".csv")]
        if not csv_names:
            raise RuntimeError("The downloaded Kaggle archive does not contain a CSV file.")
        with archive.open(csv_names[0]) as csv_file:
            return pd.read_csv(csv_file, **read_options)


def validate_source(frame: pd.DataFrame) -> None:
    missing = sorted(set(RAW_COLUMNS) - set(frame.columns))
    if missing:
        raise ValueError(f"Source is missing required columns: {', '.join(missing)}")
    if len(frame) < 1_000:
        raise ValueError("Lab 4 requires at least 1,000 source records.")


def stable_record_id(row: pd.Series) -> str:
    # The source CSV rounded long tweet IDs into scientific notation. A content-based
    # key prevents those collisions without pretending the original IDs are exact.
    key = f"{row['Timestamp']}|{row['User']}|{row['Text']}"
    return hashlib.sha256(key.encode("utf-8")).hexdigest()[:20]


def visible_source(value: object) -> str:
    if pd.isna(value):
        return "Unknown"
    text = html.unescape(str(value))
    match = re.search(r">([^<]+)</a>", text, flags=re.IGNORECASE)
    return match.group(1).strip() if match else re.sub(r"<[^>]+>", "", text).strip()


def sentiment_text(value: object) -> str:
    text = html.unescape(str(value))
    text = re.sub(r"https?://\S+|www\.\S+", "http", text)
    text = re.sub(r"@\w+", "@user", text)
    return re.sub(r"\s+", " ", text).strip()


def ensure_wordnet() -> None:
    NLTK_DATA_DIR.mkdir(parents=True, exist_ok=True)
    if str(NLTK_DATA_DIR) not in nltk.data.path:
        nltk.data.path.insert(0, str(NLTK_DATA_DIR))
    try:
        nltk.data.find("corpora/wordnet")
        return
    except LookupError:
        pass

    print("Downloading the NLTK WordNet corpus...")
    response = requests.get(
        WORDNET_URL,
        headers={"User-Agent": "STATS401-Lab4/1.0 (educational project)"},
        timeout=(30, 300),
    )
    response.raise_for_status()
    corpus_dir = NLTK_DATA_DIR / "corpora"
    corpus_dir.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(io.BytesIO(response.content)) as archive:
        destination = corpus_dir.resolve()
        for member in archive.infolist():
            member_path = (destination / member.filename).resolve()
            if destination not in member_path.parents and member_path != destination:
                raise RuntimeError("Unsafe path found in the WordNet archive.")
        archive.extractall(corpus_dir)


def clean_for_tfidf(
    value: object,
    stop_words: set[str],
    lemmatizer: WordNetLemmatizer,
) -> str:
    text = html.unescape(str(value)).lower()
    text = re.sub(r"https?://\S+|www\.\S+|@\w+", " ", text)
    tokens = re.findall(r"[a-z][a-z']{1,}", text)
    return " ".join(
        lemmatizer.lemmatize(token)
        for token in tokens
        if token not in stop_words and token not in {"rt", "amp"}
    )


def prepare_sample(source: pd.DataFrame, sample_per_year: int) -> tuple[pd.DataFrame, dict]:
    frame = source.copy()
    source_missing = frame.isna().sum().astype(int).to_dict()
    duplicate_source_ids = int(frame["ID"].duplicated(keep=False).sum())
    exact_duplicates = int(frame.duplicated().sum())

    frame["parsed_timestamp"] = pd.to_datetime(frame["Timestamp"], errors="coerce", utc=True)
    for column in ["Retweets", "Likes", "Replies", "Followers", "Following"]:
        frame[column] = pd.to_numeric(frame[column], errors="coerce")

    valid = frame.dropna(subset=["Timestamp", "User", "Text", "parsed_timestamp"]).copy()
    valid = valid[valid["Text"].astype(str).str.strip().str.len() >= 3]
    valid = valid.drop_duplicates(subset=["Timestamp", "User", "Text"])
    for column in ["Retweets", "Likes", "Replies", "Followers", "Following"]:
        valid = valid[valid[column].fillna(-1) >= 0]

    valid["year"] = valid["parsed_timestamp"].dt.year
    year_counts = valid["year"].value_counts().sort_index()
    if (year_counts < sample_per_year).any():
        insufficient = year_counts[year_counts < sample_per_year].to_dict()
        raise ValueError(f"Not enough valid records in one or more years: {insufficient}")

    pieces = []
    for year, group in valid.groupby("year", sort=True):
        pieces.append(group.sample(n=sample_per_year, random_state=RANDOM_SEED + int(year)))
    sampled = pd.concat(pieces, ignore_index=True).sort_values("parsed_timestamp").reset_index(drop=True)

    report = {
        "source_name": "FPL Tweets Dataset",
        "source_url": "https://www.kaggle.com/datasets/prasad22/fpl-tweets-dataset",
        "license": "CC0: Public Domain",
        "source_records": int(len(source)),
        "source_columns": int(len(source.columns)),
        "source_date_min": str(frame["parsed_timestamp"].min()),
        "source_date_max": str(frame["parsed_timestamp"].max()),
        "source_missing_values": source_missing,
        "exact_duplicate_rows": exact_duplicates,
        "rows_sharing_rounded_source_id": duplicate_source_ids,
        "valid_records_before_sampling": int(len(valid)),
        "sample_strategy": f"{sample_per_year} records per calendar year, random seed {RANDOM_SEED}",
        "sample_records": int(len(sampled)),
        "sample_year_counts": sampled["year"].value_counts().sort_index().astype(int).to_dict(),
        "sentiment_model": MODEL_NAME,
    }
    return sampled, report


def predict_sentiment(texts: list[str], batch_size: int) -> tuple[np.ndarray, list[str]]:
    print(f"Loading sentiment model: {MODEL_NAME}")
    tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
    model = AutoModelForSequenceClassification.from_pretrained(MODEL_NAME)
    if torch.backends.mps.is_available():
        device = torch.device("mps")
    elif torch.cuda.is_available():
        device = torch.device("cuda")
    else:
        device = torch.device("cpu")
    model.to(device)
    model.eval()
    labels = [str(model.config.id2label[index]).lower() for index in range(model.config.num_labels)]

    all_probabilities: list[np.ndarray] = []
    print(f"Scoring {len(texts):,} tweets on {device}...")
    for start in range(0, len(texts), batch_size):
        batch = texts[start : start + batch_size]
        encoded = tokenizer(
            batch,
            padding=True,
            truncation=True,
            max_length=512,
            return_tensors="pt",
        )
        encoded = {key: value.to(device) for key, value in encoded.items()}
        with torch.inference_mode():
            logits = model(**encoded).logits
            probabilities = torch.softmax(logits, dim=-1).cpu().numpy()
        all_probabilities.append(probabilities)
        completed = min(start + batch_size, len(texts))
        if completed % 500 < batch_size or completed == len(texts):
            print(f"  scored {completed:,}/{len(texts):,}")
    return np.vstack(all_probabilities), labels


def add_sentiment(frame: pd.DataFrame, batch_size: int) -> pd.DataFrame:
    probabilities, model_labels = predict_sentiment(frame["sentiment_text"].tolist(), batch_size)
    label_to_index = {label: index for index, label in enumerate(model_labels)}
    required = {"negative", "neutral", "positive"}
    if not required.issubset(label_to_index):
        raise RuntimeError(f"Unexpected model labels: {model_labels}")

    for label in ["negative", "neutral", "positive"]:
        frame[f"sentiment_{label}"] = probabilities[:, label_to_index[label]]
    frame["sentiment"] = np.array(model_labels)[probabilities.argmax(axis=1)]
    frame["sentiment"] = frame["sentiment"].str.title()
    frame["sentiment_score"] = frame["sentiment_positive"] - frame["sentiment_negative"]
    return frame


def build_top_terms(frame: pd.DataFrame) -> pd.DataFrame:
    display_stop_words = sorted(set(ENGLISH_STOP_WORDS) | {"amp", "http", "rt", "user"})
    vectorizer = TfidfVectorizer(
        stop_words=display_stop_words,
        min_df=5,
        max_df=0.9,
        max_features=2_000,
        ngram_range=(1, 2),
        token_pattern=r"(?u)\b[a-zA-Z][a-zA-Z']+\b",
    )
    matrix = vectorizer.fit_transform(frame["sentiment_text"])
    terms = np.asarray(vectorizer.get_feature_names_out())
    rows = []
    for sentiment in ["Negative", "Neutral", "Positive"]:
        mask = frame["sentiment"].eq(sentiment).to_numpy()
        class_means = np.asarray(matrix[mask].mean(axis=0)).ravel()
        other_means = np.asarray(matrix[~mask].mean(axis=0)).ravel()
        contrast = class_means - other_means
        for rank, index in enumerate(contrast.argsort()[-10:][::-1], start=1):
            rows.append(
                {
                    "sentiment": sentiment,
                    "rank": rank,
                    "term": terms[index],
                    "mean_tfidf": round(float(class_means[index]), 6),
                    "contrast_tfidf": round(float(contrast[index]), 6),
                }
            )
    return pd.DataFrame(rows)


def build_summary(frame: pd.DataFrame) -> pd.DataFrame:
    tiers = ["Low", "Medium", "High"]
    sentiments = ["Negative", "Neutral", "Positive"]
    filters = {
        "All accounts": pd.Series(True, index=frame.index),
        "Verified": frame["verified_account"],
        "Not verified": ~frame["verified_account"],
    }
    rows = []
    for account_filter, mask in filters.items():
        subset = frame[mask]
        for tier in tiers:
            tier_frame = subset[subset["engagement_tier"].eq(tier)]
            total = len(tier_frame)
            for sentiment in sentiments:
                sentiment_frame = tier_frame[tier_frame["sentiment"].eq(sentiment)]
                rows.append(
                    {
                        "account_filter": account_filter,
                        "engagement_tier": tier,
                        "sentiment": sentiment,
                        "count": int(len(sentiment_frame)),
                        "share": round(len(sentiment_frame) / total, 6) if total else 0,
                        "mean_engagement": round(float(sentiment_frame["engagement_total"].mean()), 3)
                        if len(sentiment_frame)
                        else 0,
                        "mean_sentiment_score": round(float(sentiment_frame["sentiment_score"].mean()), 6)
                        if len(sentiment_frame)
                        else 0,
                    }
                )
    return pd.DataFrame(rows)


def main() -> None:
    args = parse_args()
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    source = load_source(args.source)
    validate_source(source)
    sample, report = prepare_sample(source, args.sample_per_year)

    raw_output = DATA_DIR / "lab4_raw_tweets.csv"
    sample[RAW_COLUMNS].to_csv(raw_output, index=False)
    print(f"Saved assignment raw sample: {raw_output} ({len(sample):,} rows)")

    ensure_wordnet()
    stop_words = set(ENGLISH_STOP_WORDS)
    lemmatizer = WordNetLemmatizer()

    clean = pd.DataFrame(
        {
            "tweet_id": sample.apply(stable_record_id, axis=1),
            "source_tweet_id": sample["ID"].astype(str),
            "created_at": sample["parsed_timestamp"].dt.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "year": sample["year"].astype(int),
            "user": sample["User"].astype(str).str.strip(),
            "tweet_text_raw": sample["Text"].astype(str),
            "hashtags": sample["Hashtag"].fillna("No hashtag").astype(str),
            "retweets": sample["Retweets"].astype(int),
            "likes": sample["Likes"].astype(int),
            "replies": sample["Replies"].astype(int),
            "source": sample["Source"].map(visible_source).replace("", "Unknown"),
            "location": sample["Location"].fillna("Unknown").astype(str).str.strip().replace("", "Unknown"),
            "verified_account": sample["Verified_Account"].astype(bool),
            "followers": sample["Followers"].astype(int),
            "following": sample["Following"].astype(int),
        }
    )
    clean["engagement_total"] = clean[["retweets", "likes", "replies"]].sum(axis=1)
    clean["engagement_tier"] = pd.cut(
        clean["engagement_total"],
        bins=[-1, 0, 4, np.inf],
        labels=["Low", "Medium", "High"],
    ).astype(str)
    clean["sentiment_text"] = clean["tweet_text_raw"].map(sentiment_text)
    clean["text_clean"] = clean["tweet_text_raw"].map(
        lambda value: clean_for_tfidf(value, stop_words, lemmatizer)
    ).replace("", "no_terms")
    clean["is_auto_share"] = clean["tweet_text_raw"].str.contains(
        r"I scored \d+ points in Gameweek", case=False, regex=True
    )
    clean = add_sentiment(clean, args.batch_size)

    probability_columns = ["sentiment_negative", "sentiment_neutral", "sentiment_positive"]
    clean[probability_columns + ["sentiment_score"]] = clean[
        probability_columns + ["sentiment_score"]
    ].round(6)

    clean_output = DATA_DIR / "lab4_clean_tweets.csv"
    summary_output = DATA_DIR / "lab4_fpl_sentiment_summary.csv"
    terms_output = DATA_DIR / "lab4_fpl_top_terms.csv"
    report_output = DATA_DIR / "lab4_cleaning_report.json"
    clean.to_csv(clean_output, index=False)
    build_summary(clean).to_csv(summary_output, index=False)
    build_top_terms(clean).to_csv(terms_output, index=False)

    report.update(
        {
            "clean_records": int(len(clean)),
            "unique_clean_record_ids": int(clean["tweet_id"].nunique()),
            "clean_missing_values": clean.isna().sum().astype(int).to_dict(),
            "sentiment_counts": clean["sentiment"].value_counts().astype(int).to_dict(),
            "engagement_tier_counts": clean["engagement_tier"].value_counts().astype(int).to_dict(),
            "verified_accounts_in_sample": int(clean["verified_account"].sum()),
            "auto_share_tweets_in_sample": int(clean["is_auto_share"].sum()),
        }
    )
    report_output.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")

    print(f"Saved cleaned tweets: {clean_output}")
    print(f"Saved chart summary: {summary_output}")
    print(f"Saved TF-IDF terms: {terms_output}")
    print(f"Saved cleaning report: {report_output}")
    print(clean["sentiment"].value_counts().to_string())


if __name__ == "__main__":
    main()
