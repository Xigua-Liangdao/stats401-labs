# One-minute presentation

**Teresa Tu - STATS 401**

This is a 123-word speaking script, approximately one minute at a measured pace. The submitted slide stays on screen throughout.

> I redesigned Information is Beautiful's data breach visualization. Its bubbles make major breaches memorable, but large circles dominate the space, small labels become difficult to read, and area comparisons are imprecise.
>
> My D3 explorer gives every event an equal-sized dot. Readers can animate between industry groups, breach methods, and a shared logarithmic scale. Industry colors stay consistent, helping readers follow the same events as the layout changes. Clicking a dot reveals the reported count and source.
>
> The dataset contains 539 events. I place 499 on the numeric axis and keep 40 without comparable counts separate, rather than treating placeholders as measurements.
>
> The redesign supports comparison and exploration, although equal-sized dots reduce the visual impact of huge breaches, and the logarithmic scale requires explanation.

Suggested timing: original and critique, 0-15 seconds; redesign decisions, 15-40 seconds; data handling and tradeoff, 40-60 seconds.

Slide: [Teresa_Tu.pdf](assets/Teresa_Tu.pdf)

Interactive project: [Data Breaches, Reassembled](https://xigua-liangdao.github.io/stats401-labs/individual-project/)

Original visual and dataset: [Information is Beautiful](https://informationisbeautiful.net/visualizations/worlds-biggest-data-breaches-hacks/), snapshot acquired September 25, 2026. Both screenshots are viewport excerpts, and they show different subsets of the complete views. The original excerpt shows the chart's top section. The redesign excerpt shows the implemented D3 size-comparison view's controls and first industry rows, with all 539 events selected across the full view.
