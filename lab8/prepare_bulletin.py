import argparse
import collections
import csv
import hashlib
import json
import re
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
PDF = DATA / "lab8_bulletin_2021_2022.pdf"
SOURCE = "https://dku-web-admissions.s3.cn-north-1.amazonaws.com.cn/dkumain/files/V2021-22_DKU_UG_Bulletin.pdf"
MODEL = "sentence-transformers/all-MiniLM-L6-v2"
MODEL_REVISION = "1110a243fdf4706b3f48f1d95db1a4f5529b4d41"
CACHE = Path.home() / ".cache" / "stats401-lab8"


def clean_text(text):
    text = unicodedata.normalize("NFKC", text).replace("\u00ad", "").replace("\u200b", "")
    return re.sub(r"\s+", " ", text).strip()


def normalized(text):
    return re.sub(r"[^a-z0-9]", "", text.casefold())


def save_csv(path, rows):
    with path.open("w", newline="", encoding="utf-8") as stream:
        writer = csv.DictWriter(stream, fieldnames=list(rows[0]), lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)


def extract_passages():
    import pdfplumber
    from pypdf import PdfReader

    reader = PdfReader(PDF)
    headings = []

    def walk(items, level=1):
        for item in items:
            if isinstance(item, list):
                walk(item, level + 1)
            else:
                headings.append({"level": level, "title": clean_text(item.title),
                                 "page": reader.get_destination_page_number(item) + 1,
                                 "top": 792 - float(item.get("/Top", 720))})

    walk(reader.outline)
    headings.sort(key=lambda h: (h["page"], h["top"], h["level"]))
    page_headings = collections.defaultdict(list)
    for heading in headings:
        page_headings[heading["page"]].append(heading)
    stack = {}
    raw = []
    pending = []
    pending_meta = None

    def flush():
        nonlocal pending, pending_meta
        if pending:
            raw.append({"raw_id": f"r{len(raw) + 1:05d}", **pending_meta,
                        "page_end": pending[-1][1], "text": clean_text(" ".join(line[0] for line in pending))})
        pending = []
        pending_meta = None

    with pdfplumber.open(PDF) as pdf:
        for page_number in range(10, 397):
            page = pdf.pages[page_number - 1]
            entries = page_headings[page_number]
            cursor = 0
            previous = None
            for line in page.extract_text_lines():
                text = clean_text(line["text"])
                if not text or line["top"] >= 735 or line["bottom"] < 68:
                    continue
                while cursor < len(entries) and entries[cursor]["top"] <= line["top"] + 1:
                    heading = entries[cursor]
                    flush()
                    stack = {level: title for level, title in stack.items() if level < heading["level"]}
                    stack[heading["level"]] = heading["title"]
                    cursor += 1
                key = normalized(text)
                bold = sum("Bold" in char["fontname"] for char in line["chars"]) / max(1, len(line["chars"]))
                is_heading = bold > 0.7 and any(key in normalized(title) for title in stack.values())
                font_size = collections.Counter(round(char["size"], 1) for char in line["chars"]).most_common(1)[0][0]
                table_row = bool(re.match(r"^[A-Z]{2,}(?:\s*/\s*[A-Z]+)?\s+\d{2,3}[A-Z]?\b", text) and re.search(r"\s\d(?:-\d)?$", text))
                table_header = text in {"Course", "Credit", "Credits", "Course Code Course Name", "Course Code", "Course Name"}
                if font_size < 10.5:
                    continue
                if is_heading or table_row or table_header:
                    flush()
                    previous = None
                    continue
                chapter = stack.get(1, "")
                section = stack.get(2, "Introduction")
                metadata = {"chapter": chapter, "section": section,
                            "subsection": " / ".join(stack[level] for level in sorted(stack) if level >= 3),
                            "heading_path": " > ".join(stack[level] for level in sorted(stack)), "page": page_number}
                if pending:
                    changed = pending_meta["heading_path"] != metadata["heading_path"]
                    gap = previous and line["top"] - previous["bottom"] > 7
                    new_page = previous is None and not re.match(r"^[a-z,;)]", text)
                    bullet = bool(re.match(r"^(?:[•●▪]|\d+[.)])\s", text))
                    if changed or gap or new_page or bullet:
                        flush()
                if not pending:
                    pending_meta = metadata
                pending.append((text, page_number))
                previous = line
            page.close()
            if page_number % 50 == 0:
                print(f"Extracted page {page_number}/400", flush=True)
    flush()
    save_csv(DATA / "lab8_passages_raw.csv", raw)
    return raw


def prepare(raw):
    cleaned = []
    seen = set()
    removed = collections.Counter()
    for row in raw:
        text = clean_text(row["text"])
        words = text.split()
        key = text.casefold()
        if len(words) < 20:
            removed["short_fragments"] += 1
            continue
        if sum(char.isalpha() for char in text) / max(1, len(text)) < 0.6 or "Course Code Course Name" in text or (len(words) < 40 and not re.search(r"[.!?;:]", text)):
            removed["malformed_or_table_fragments"] += 1
            continue
        if key in seen:
            removed["duplicates"] += 1
            continue
        seen.add(key)
        cleaned.append({"passage_id": f"p{len(cleaned) + 1:04d}", **row, "text": text, "word_count": len(words)})
    return cleaned, dict(removed)


def analyze(passages, raw_count, removed, args):
    import numpy as np
    import torch
    import umap
    from sentence_transformers import SentenceTransformer
    from sklearn.cluster import KMeans
    from sklearn.feature_extraction.text import ENGLISH_STOP_WORDS, CountVectorizer, TfidfVectorizer
    from sklearn.metrics import silhouette_score

    CACHE.mkdir(parents=True, exist_ok=True)
    torch.set_num_threads(4)
    texts = [row["text"] for row in passages]
    digest = hashlib.sha256(json.dumps(texts).encode()).hexdigest()
    embedding_file = CACHE / f"embeddings-{digest[:16]}.npz"
    model_location = args.model_path or MODEL
    if embedding_file.exists():
        stored = np.load(embedding_file)
        embeddings = stored["embeddings"]
        model_revision = str(stored["revision"])
        window_count = int(stored["window_count"])
    else:
        model = SentenceTransformer(model_location, device="cpu", revision=None if args.model_path else MODEL_REVISION)
        model_revision = str(getattr(model[0].auto_model.config, "_commit_hash", None) or "local snapshot")
        windows = []
        owners = []
        weights = []
        for index, text in enumerate(texts):
            tokens = model.tokenizer.encode(text, add_special_tokens=False)
            for start in range(0, len(tokens), 220):
                chunk = tokens[start:start + 220]
                windows.append(model.tokenizer.decode(chunk, skip_special_tokens=True))
                owners.append(index)
                weights.append(len(chunk))
        encoded = model.encode(windows, batch_size=32, normalize_embeddings=True, show_progress_bar=True)
        embeddings = np.zeros((len(passages), encoded.shape[1]), dtype=np.float32)
        for vector, owner, weight in zip(encoded, owners, weights):
            embeddings[owner] += vector * weight
        embeddings /= np.linalg.norm(embeddings, axis=1, keepdims=True)
        window_count = len(windows)
        np.savez_compressed(embedding_file, embeddings=embeddings, revision=model_revision, window_count=window_count)
    print(f"Encoded {len(passages)} passages in {window_count} windows", flush=True)
    if not np.isfinite(embeddings).all():
        raise ValueError("Embeddings contain non-finite values")
    clusterer = KMeans(n_clusters=8, random_state=401, n_init=20)
    clusters = clusterer.fit_predict(embeddings)
    coords = umap.UMAP(n_components=2, n_neighbors=15, min_dist=0.15, metric="cosine", random_state=401).fit_transform(embeddings)
    similarity = embeddings @ embeddings.T
    if not np.isfinite(coords).all() or not np.isfinite(similarity).all():
        raise ValueError("Projection or similarity contains non-finite values")
    np.fill_diagonal(similarity, -1)
    neighbors = np.argsort(-similarity, axis=1)[:, :5]
    stop_words = sorted(set(ENGLISH_STOP_WORDS) | {"student", "students", "course", "courses", "university", "duke", "kunshan", "dku", "will", "including", "include", "includes"})
    vectorizer = TfidfVectorizer(stop_words=stop_words, min_df=3, max_df=0.85, ngram_range=(1, 2), token_pattern=r"(?u)\b[a-zA-Z][a-zA-Z-]{2,}\b")
    tfidf = vectorizer.fit_transform(texts)
    vocabulary = vectorizer.get_feature_names_out()
    topic_path = ROOT / "lab8" / "topics.json"
    names = json.loads(topic_path.read_text()) if topic_path.exists() else {}
    topics = []
    review = []
    for cluster in range(8):
        indices = np.flatnonzero(clusters == cluster)
        scores = np.asarray(tfidf[indices].mean(axis=0)).ravel()
        terms = vocabulary[scores.argsort()[-10:][::-1]].tolist()
        centroid = clusterer.cluster_centers_[cluster]
        representative = indices[np.argsort(-(embeddings[indices] @ centroid))[:6]]
        name = names.get(str(cluster), f"Topic {cluster + 1}")
        topics.append({"id": cluster, "name": name, "count": len(indices), "terms": terms})
        review.append({"cluster": cluster, "count": len(indices), "terms": terms,
                       "representatives": [{key: passages[index][key] for key in ["passage_id", "chapter", "section", "subsection", "page", "text"]} for index in representative]})
    (CACHE / "cluster_review.json").write_text(json.dumps(review, ensure_ascii=False, indent=2))
    terms_model = CountVectorizer(stop_words=stop_words, min_df=3, token_pattern=r"(?u)\b[a-zA-Z][a-zA-Z-]{2,}\b")
    counts = terms_model.fit_transform(texts)
    counts = np.asarray(counts.sum(axis=0)).ravel()
    terms = terms_model.get_feature_names_out()
    top_terms = [{"term": str(terms[i]), "count": int(counts[i])} for i in counts.argsort()[-12:][::-1]]
    matrix = collections.Counter()
    sections = {}
    neighbor_data = {}
    for index, row in enumerate(passages):
        section_key = row["chapter"] + " | " + row["section"]
        row.update(section_key=section_key, cluster=int(clusters[index]), cluster_name=topics[clusters[index]]["name"],
                   x=round(float(coords[index, 0]), 6), y=round(float(coords[index, 1]), 6))
        matrix[(section_key, int(clusters[index]))] += 1
        section = sections.setdefault(section_key, {"key": section_key, "chapter": row["chapter"], "name": row["section"], "count": 0, "words": 0, "page": int(row["page"]), "topics": [0] * 8})
        section["count"] += 1
        section["words"] += row["word_count"]
        section["topics"][clusters[index]] += 1
        neighbor_data[row["passage_id"]] = [{"id": passages[j]["passage_id"], "similarity": round(float(similarity[index, j]), 6)} for j in neighbors[index]]
    for section in sections.values():
        section["average_words"] = round(section["words"] / section["count"], 1)
        proportions = np.array(section["topics"]) / section["count"]
        section["entropy"] = round(float(-sum(p * np.log2(p) for p in proportions if p > 0)), 3)
    source_hash = hashlib.sha256(PDF.read_bytes()).hexdigest()
    summary = {
        "source": {"title": "Bulletin of Duke Kunshan University Undergraduate Instruction", "version": "2021–2022 (July 2021)", "url": SOURCE, "accessed": args.accessed, "pdf_pages": 400, "sha256": source_hash},
        "corpus": {"raw_passages": raw_count, "clean_passages": len(passages), "average_words": round(sum(row["word_count"] for row in passages) / len(passages), 1), "sections": len(sections), "chapters": len(set(row["chapter"] for row in passages)), "removed": removed, "coverage": "Prose on pages 10–396. Cover, contents, calendar/contact tables, small-print footnotes, course-list rows, and fragments under 20 words are excluded. Exact duplicate text is retained only once; chapter, section, subsection, and start/end pages come from PDF bookmarks and text positions."},
        "model": {"name": MODEL, "revision": model_revision, "dimensions": int(embeddings.shape[1]), "normalized": True, "window_tokens": 220, "windows": window_count, "aggregation": "Token-count-weighted mean of normalized window vectors, then L2 normalization; no passage tail is truncated."},
        "umap": {"n_components": 2, "n_neighbors": 15, "min_dist": 0.15, "metric": "cosine", "random_state": 401},
        "clustering": {"method": "KMeans on normalized original 384-dimensional embeddings", "clusters": 8, "n_init": 20, "random_state": 401, "cosine_silhouette": round(float(silhouette_score(embeddings, clusters, metric="cosine")), 4)},
        "topics": topics, "sections": list(sections.values()), "top_terms": top_terms
    }
    save_csv(DATA / "lab8_embedding_map.csv", passages)
    save_csv(DATA / "lab8_topic_section_matrix.csv", [{"section_key": key, "cluster": cluster, "cluster_name": topics[cluster]["name"], "count": count} for (key, cluster), count in matrix.items()])
    (DATA / "lab8_neighbors.json").write_text(json.dumps(neighbor_data, separators=(",", ":")))
    (DATA / "lab8_analysis.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2))
    np.savez_compressed(CACHE / "analysis_vectors.npz", embeddings=embeddings, clusters=clusters, similarity=similarity)
    print(json.dumps(summary["corpus"], indent=2), flush=True)
    print("Cluster review:", CACHE / "cluster_review.json", flush=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--extract-only", action="store_true")
    parser.add_argument("--rebuild", action="store_true")
    parser.add_argument("--model-path")
    parser.add_argument("--accessed", default="2026-09-22")
    args = parser.parse_args()
    if not PDF.exists():
        import requests
        response = requests.get(SOURCE, timeout=120)
        response.raise_for_status()
        PDF.write_bytes(response.content)
    raw_path = DATA / "lab8_passages_raw.csv"
    if raw_path.exists() and not args.rebuild:
        with raw_path.open(encoding="utf-8") as stream:
            raw = list(csv.DictReader(stream))
    else:
        raw = extract_passages()
    passages, removed = prepare(raw)
    save_csv(DATA / "lab8_passages_clean.csv", passages)
    print(f"Raw: {len(raw)}; clean: {len(passages)}; removed: {removed}", flush=True)
    if not args.extract_only:
        analyze(passages, len(raw), removed, args)


if __name__ == "__main__":
    main()
