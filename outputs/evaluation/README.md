# DeepGuard Controlled Evaluation Evidence

This folder contains the reproducible evidence used in Chapter 5 of the final graduation-project report.

## Files

- `controlled_evaluation_cases.csv`: Eleven labelled camera trials with source type, actual class, system decision, quality, texture risk, liveness result, and end-to-end latency.
- `evaluation_summary.json`: Confusion counts, classification metrics, decision coverage, latency statistics, and measured local resource use.

## Interpretation

The controlled set contains eight known-genuine physical-camera trials and three known-attack OBS virtual-camera trials. Ten trials received automatic decisions and one genuine low-quality trial was routed to manual review.

The reported 100% precision, recall, F1-score, specificity, and covered-case accuracy apply only to the ten automatically decided cases in this small controlled set. They are not claims of production accuracy or generalization to public datasets, unseen identities, devices, lighting conditions, or advanced attacks.

The texture classifier produced scores close to 50.8% across these trials and is not yet sufficiently discriminative on this sample. The prototype therefore relies strongly on active liveness, input-source integrity, quality checks, and human review for uncertain cases. A larger labelled benchmark is required before deployment thresholds can be approved.

## Reproduction

From the `deepguard` folder, run:

```powershell
.\.venv\Scripts\python.exe scripts\generate_evaluation_artifacts.py
```
