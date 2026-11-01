"""CLI entry point for training.

Usage (from ml-service/):
    python -m scripts.train --data ../dataset/processed/training.csv
"""
import argparse


def main() -> None:
    parser = argparse.ArgumentParser(description="Train the readmission model.")
    parser.add_argument("--data", required=True, help="Path to processed training CSV")
    parser.add_argument("--out", default="model/readmission_model.joblib")
    args = parser.parse_args()
    # TODO (Member 3): load CSV -> build_features -> train_model -> evaluate_model -> save_model
    print(f"[scaffold] would train on {args.data} and save to {args.out}")


if __name__ == "__main__":
    main()
