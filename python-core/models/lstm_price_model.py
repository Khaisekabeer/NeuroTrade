"""PyTorch LSTM for next-bar return prediction.

Architecture: 2-layer LSTM over a 32-bar feature window -> linear -> scalar return.
Trained with MSE on forward 1-bar returns. See train.py.
"""
from __future__ import annotations
import torch
import torch.nn as nn


class LSTMPriceModel(nn.Module):
    def __init__(self, input_size: int = 9, hidden: int = 64, layers: int = 2):
        super().__init__()
        self.lstm = nn.LSTM(input_size, hidden, num_layers=layers, batch_first=True, dropout=0.1)
        self.head = nn.Sequential(
            nn.Linear(hidden, 32),
            nn.ReLU(),
            nn.Linear(32, 1),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x: (batch, seq, features)
        out, _ = self.lstm(x)
        last = out[:, -1, :]
        return self.head(last)


def make_sequences(features, targets, seq_len: int = 32):
    import numpy as np
    X, y = [], []
    for i in range(len(features) - seq_len):
        X.append(features[i:i + seq_len])
        y.append(targets[i + seq_len])
    return np.array(X), np.array(y)
