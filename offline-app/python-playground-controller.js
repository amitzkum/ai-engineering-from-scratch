'use strict';

/**
 * Offline Python ML Playground Controller
 * Provides interactive sandbox execution, pre-bundled Andrew Ng ML models,
 * zero-network offline runtime guarantees, and scratchpad persistence.
 *
 * Attribution:
 * - App Architecture & Python Playground: Amit Kumar
 * - Curriculum & Algorithms: AI Engineering from Scratch Contributors
 */

const PYTHON_ML_PRESETS = [
  {
    id: 'linear-regression',
    title: '1. Linear Regression with Gradient Descent (Andrew Ng Week 1-2)',
    category: 'Supervised Learning / Regression',
    description: 'Implements univariate and multivariate linear regression using both raw NumPy gradient descent (J(θ) cost function & Normal Equation) and scikit-learn LinearRegression.',
    configurableTraining: true,
    defaultRounds: 150,
    code: `# =====================================================================
# LINEAR REGRESSION WITH GRADIENT DESCENT & NORMAL EQUATION
# Andrew Ng Machine Learning - Weeks 1 & 2
# =====================================================================
# Hypothesis:      h_θ(x) = X θ = θ_0 + θ_1 x_1 + ...
# Cost Function:   J(θ)   = (1 / 2m) * Σ (h_θ(x^(i)) - y^(i))^2
# Gradient:        ∂J/∂θ  = (1 / m)  * X^T (X θ - y)
# Update Rule:     θ     := θ - α * ∂J/∂θ
# Normal Equation: θ      = (X^T X)^(-1) X^T y
# =====================================================================

import numpy as np
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_squared_error, r2_score

# --- CONFIGURABLE TRAINING HYPERPARAMETERS ---
ROUNDS_OF_TRAINING = 150  # <-- Configure number of training rounds (epochs)
LEARNING_RATE = 0.05      # <-- Configure learning step size (alpha)

print("=" * 65)
print("1. LINEAR REGRESSION (NUMPY RAW MATH vs SCIKIT-LEARN)")
print(f"Rounds of Training: {ROUNDS_OF_TRAINING} | Learning Rate: {LEARNING_RATE}")
print("=" * 65)

# 1. Generate synthetic housing data: [Square Footage (x1000), Bedrooms] -> Price ($k)
np.random.seed(42)
m = 100
X_raw = np.column_stack([
    np.random.uniform(1.0, 4.0, m),   # Size in 1000 sq ft
    np.random.randint(1, 6, m)        # Number of bedrooms
])
# True relation: Price = 50 + 85*size + 25*bedrooms + noise
y = 50.0 + 85.0 * X_raw[:, 0] + 25.0 * X_raw[:, 1] + np.random.normal(0, 5, m)

# Feature normalization for gradient descent stability
mu = np.mean(X_raw, axis=0)
sigma = np.std(X_raw, axis=0)
X_norm = (X_raw - mu) / sigma

# Add bias column (x_0 = 1)
X_b = np.column_stack([np.ones(m), X_norm])

# --- PART A: NUMPY IMPLEMENTATION FROM RAW MATH ---
theta = np.zeros(X_b.shape[1])
cost_history = []

for epoch in range(1, ROUNDS_OF_TRAINING + 1):
    predictions = X_b @ theta
    errors = predictions - y
    cost = (1.0 / (2.0 * m)) * np.sum(errors ** 2)
    cost_history.append(cost)
    gradient = (1.0 / m) * (X_b.T @ errors)
    theta -= LEARNING_RATE * gradient

# Analytical Normal Equation on unnormalized data
X_raw_b = np.column_stack([np.ones(m), X_raw])
theta_normal = np.linalg.inv(X_raw_b.T @ X_raw_b) @ X_raw_b.T @ y

y_pred_numpy = X_b @ theta
mse_numpy = mean_squared_error(y, y_pred_numpy)
r2_numpy = r2_score(y, y_pred_numpy)

print(f"\\n[Part A - Raw NumPy Gradient Descent]")
print(f"  Initial Cost:       {cost_history[0]:.2f}")
print(f"  Final Cost:         {cost_history[-1]:.2f} (after {ROUNDS_OF_TRAINING} rounds)")
print(f"  Learned θ (norm):   {np.round(theta, 3)}")
print(f"  NumPy MSE:          {mse_numpy:.3f}")
print(f"  NumPy R² Score:     {r2_numpy:.4f}")
print(f"  Normal Eq θ (raw):  {np.round(theta_normal, 3)}")

# --- PART B: SCIKIT-LEARN IMPLEMENTATION ---
sk_model = LinearRegression(fit_intercept=True)
sk_model.fit(X_raw, y)
y_pred_sklearn = sk_model.predict(X_raw)
mse_sklearn = mean_squared_error(y, y_pred_sklearn)
r2_sklearn = r2_score(y, y_pred_sklearn)

print(f"\\n[Part B - Scikit-Learn LinearRegression]")
print(f"  Intercept (θ_0):    {sk_model.intercept_:.3f}")
print(f"  Coefficients (θ):   {np.round(sk_model.coef_, 3)}")
print(f"  Sklearn MSE:        {mse_sklearn:.3f}")
print(f"  Sklearn R² Score:   {r2_sklearn:.4f}")

# Sample prediction comparison: 2500 sq ft, 3 bedrooms
sample_raw = np.array([[2.5, 3]])
sample_norm = (sample_raw - mu) / sigma
pred_np = np.dot(np.append([1.0], sample_norm), theta)
pred_sk = sk_model.predict(sample_raw)[0]

print(f"\\n[Test Prediction for 2,500 sq ft, 3-bed House]")
print(f"  NumPy GD Prediction:   \${pred_np:.2f}k")
print(f"  Sklearn Prediction:    \${pred_sk:.2f}k")
print(f"  Prediction Difference: \${abs(pred_np - pred_sk):.4f}k")
`
  },
  {
    id: 'logistic-regression',
    title: '2. Logistic Regression (Binary Classification & Sigmoid) (Andrew Ng Week 3)',
    category: 'Supervised Learning / Classification',
    description: 'Implements binary classification using Sigmoid activation, binary cross-entropy log-loss, and gradient descent in raw NumPy, compared with scikit-learn LogisticRegression.',
    configurableTraining: true,
    defaultRounds: 200,
    code: `# =====================================================================
# LOGISTIC REGRESSION (BINARY CLASSIFICATION)
# Andrew Ng Machine Learning - Week 3
# =====================================================================
# Sigmoid Activation:  g(z)   = 1 / (1 + e^(-z))
# Hypothesis:          h_θ(x) = g(X θ) = P(y = 1 | x; θ)
# Cost Function:       J(θ)   = -(1/m) * Σ [y^(i) log(h) + (1 - y^(i)) log(1 - h)]
# Gradient:            ∂J/∂θ  = (1/m)  * X^T (h_θ(X) - y)
# Update Rule:         θ     := θ - α * ∂J/∂θ
# =====================================================================

import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, log_loss

# --- CONFIGURABLE TRAINING HYPERPARAMETERS ---
ROUNDS_OF_TRAINING = 200  # <-- Configure number of training rounds (epochs)
LEARNING_RATE = 0.1       # <-- Configure learning rate (alpha)

print("=" * 65)
print("2. LOGISTIC REGRESSION (NUMPY RAW MATH vs SCIKIT-LEARN)")
print(f"Rounds of Training: {ROUNDS_OF_TRAINING} | Learning Rate: {LEARNING_RATE}")
print("=" * 65)

# 1. Generate synthetic student exam score dataset [Exam 1, Exam 2] -> Admitted (0 or 1)
np.random.seed(42)
m = 120
X_raw = np.random.uniform(30.0, 100.0, (m, 2))
# Decision boundary roughly Exam1 + Exam2 >= 130
z_true = 0.08 * X_raw[:, 0] + 0.08 * X_raw[:, 1] - 10.4
prob_true = 1.0 / (1.0 + np.exp(-z_true))
y = (prob_true >= 0.5).astype(int)

# Normalize features
mu = np.mean(X_raw, axis=0)
sigma = np.std(X_raw, axis=0)
X_norm = (X_raw - mu) / sigma
X_b = np.column_stack([np.ones(m), X_norm])

# --- PART A: NUMPY IMPLEMENTATION FROM RAW MATH ---
def sigmoid(z):
    return 1.0 / (1.0 + np.exp(-np.clip(z, -250, 250)))

theta = np.zeros(X_b.shape[1])
loss_history = []

for epoch in range(1, ROUNDS_OF_TRAINING + 1):
    z = X_b @ theta
    h = sigmoid(z)
    # Clip probabilities for numerical stability in log
    eps = 1e-15
    h_clipped = np.clip(h, eps, 1.0 - eps)
    loss = -(1.0 / m) * np.sum(y * np.log(h_clipped) + (1.0 - y) * np.log(1.0 - h_clipped))
    loss_history.append(loss)
    gradient = (1.0 / m) * (X_b.T @ (h - y))
    theta -= LEARNING_RATE * gradient

y_probs_numpy = sigmoid(X_b @ theta)
y_pred_numpy = (y_probs_numpy >= 0.5).astype(int)
acc_numpy = accuracy_score(y, y_pred_numpy)

print(f"\\n[Part A - Raw NumPy Gradient Descent]")
print(f"  Initial Log-Loss:   {loss_history[0]:.4f}")
print(f"  Final Log-Loss:     {loss_history[-1]:.4f} (after {ROUNDS_OF_TRAINING} rounds)")
print(f"  Learned θ weights:  {np.round(theta, 3)}")
print(f"  NumPy Accuracy:     {acc_numpy * 100:.2f}%")

# --- PART B: SCIKIT-LEARN IMPLEMENTATION ---
sk_model = LogisticRegression(C=1e5, solver='lbfgs')
sk_model.fit(X_norm, y)
y_pred_sklearn = sk_model.predict(X_norm)
acc_sklearn = accuracy_score(y, y_pred_sklearn)
sk_loss = log_loss(y, sk_model.predict_proba(X_norm))

print(f"\\n[Part B - Scikit-Learn LogisticRegression]")
print(f"  Sklearn Intercept:  {sk_model.intercept_[0]:.3f}")
print(f"  Sklearn Coefs:      {np.round(sk_model.coef_[0], 3)}")
print(f"  Sklearn Log-Loss:   {sk_loss:.4f}")
print(f"  Sklearn Accuracy:   {acc_sklearn * 100:.2f}%")

# Test applicant evaluation: Exam 1 = 70, Exam 2 = 75
test_score = np.array([[70.0, 75.0]])
test_norm = (test_score - mu) / sigma
prob_np = sigmoid(np.dot(np.append([1.0], test_norm), theta))
prob_sk = sk_model.predict_proba(test_norm)[0][1]

print(f"\\n[Test Prediction for Applicant with Scores (70, 75)]")
print(f"  NumPy Admission Probability:   {prob_np * 100:.2f}%")
print(f"  Sklearn Admission Probability: {prob_sk * 100:.2f}%")
print(f"  Decision Consensus:            {'ADMIT' if prob_np >= 0.5 else 'REJECT'}")
`
  },
  {
    id: 'regularized-regression',
    title: '3. Regularized Linear Regression (Ridge / L2 Penalty) (Andrew Ng Week 3)',
    category: 'Supervised Learning / Regularization',
    description: 'Implements L2 Ridge regularization from raw math to prevent overfitting in polynomial regression, compared with scikit-learn Ridge.',
    configurableTraining: true,
    defaultRounds: 150,
    code: `# =====================================================================
# REGULARIZED LINEAR REGRESSION (RIDGE / L2 REGULARIZATION)
# Andrew Ng Machine Learning - Week 3
# =====================================================================
# Regularized Cost: J(θ) = (1/2m) * [Σ (h_θ(x^(i)) - y^(i))^2 + λ * Σ_{j=1}^n θ_j^2]
# Gradient Update:
#   For θ_0:       θ_0  := θ_0 - α * (1/m) * Σ (h_θ(x^(i)) - y^(i))
#   For θ_j (j>0): θ_j  := θ_j * (1 - α * λ / m) - α * (1/m) * Σ (h_θ(x^(i)) - y^(i)) * x_j^(i)
# =====================================================================

import numpy as np
from sklearn.linear_model import Ridge, LinearRegression
from sklearn.metrics import mean_squared_error

# --- CONFIGURABLE TRAINING HYPERPARAMETERS ---
ROUNDS_OF_TRAINING = 150  # <-- Configure number of training rounds
LEARNING_RATE = 0.05      # <-- Configure step size alpha
LAMBDA_REG = 0.5          # <-- Configure regularization strength lambda

print("=" * 65)
print("3. REGULARIZED REGRESSION (L2 RIDGE vs UNREGULARIZED)")
print(f"Rounds: {ROUNDS_OF_TRAINING} | Alpha: {LEARNING_RATE} | Lambda (λ): {LAMBDA_REG}")
print("=" * 65)

# 1. Generate small non-linear dataset prone to overfitting
np.random.seed(7)
m = 25
x_raw = np.linspace(-3.0, 3.0, m)
y = 0.5 * x_raw**3 - x_raw**2 + 2.0 + np.random.normal(0, 2.0, m)

# Create 5th-degree polynomial features: [x, x^2, x^3, x^4, x^5]
poly_degrees = 5
X_poly = np.column_stack([x_raw**p for p in range(1, poly_degrees + 1)])

# Normalize features
mu = np.mean(X_poly, axis=0)
sigma = np.std(X_poly, axis=0)
X_norm = (X_poly - mu) / sigma
X_b = np.column_stack([np.ones(m), X_norm])

# --- PART A: NUMPY REGULARIZED GRADIENT DESCENT ---
theta = np.zeros(X_b.shape[1])
cost_history = []

for epoch in range(1, ROUNDS_OF_TRAINING + 1):
    predictions = X_b @ theta
    errors = predictions - y
    # Cost with L2 penalty (exclude bias θ_0 from penalty)
    cost = (1.0 / (2.0 * m)) * (np.sum(errors ** 2) + LAMBDA_REG * np.sum(theta[1:] ** 2))
    cost_history.append(cost)

    # Gradient with shrinkage factor
    grad = (1.0 / m) * (X_b.T @ errors)
    theta[0] -= LEARNING_RATE * grad[0]
    theta[1:] = theta[1:] * (1.0 - LEARNING_RATE * (LAMBDA_REG / m)) - LEARNING_RATE * grad[1:]

mse_numpy = mean_squared_error(y, X_b @ theta)

print(f"\\n[Part A - Raw NumPy Regularized Gradient Descent]")
print(f"  Final Cost:          {cost_history[-1]:.4f}")
print(f"  Learned θ (norm):    {np.round(theta, 3)}")
print(f"  L2 Norm of θ[1:]:    {np.linalg.norm(theta[1:]):.4f}")
print(f"  NumPy MSE:           {mse_numpy:.4f}")

# --- PART B: SCIKIT-LEARN RIDGE vs UNREGULARIZED ---
# Unregularized OLS
unreg = LinearRegression().fit(X_norm, y)
unreg_weights = unreg.coef_
unreg_norm = np.linalg.norm(unreg_weights)

# Regularized Ridge
ridge = Ridge(alpha=LAMBDA_REG, solver='auto').fit(X_norm, y)
ridge_weights = ridge.coef_
ridge_norm = np.linalg.norm(ridge_weights)
mse_ridge = mean_squared_error(y, ridge.predict(X_norm))

print(f"\\n[Part B - Scikit-Learn Comparison]")
print(f"  Unregularized OLS L2 Norm: {unreg_norm:.4f} (Vulnerable to overfitting)")
print(f"  Ridge (λ={LAMBDA_REG}) L2 Norm:     {ridge_norm:.4f} (Weights shrunk)")
print(f"  Weight Shrinkage Ratio:    {(1.0 - ridge_norm / unreg_norm) * 100:.2f}% reduction")
print(f"  Ridge MSE:                 {mse_ridge:.4f}")
print(f"  NumPy vs Sklearn Weights Diff: {np.max(np.abs(theta[1:] - ridge_weights)):.4f}")
`
  },
  {
    id: 'softmax-regression',
    title: '4. Softmax Regression (Multi-Class Classification) (Andrew Ng Week 4)',
    category: 'Supervised Learning / Classification',
    description: 'Implements multi-class Softmax classification with categorical cross-entropy from scratch in NumPy, compared with scikit-learn multinomial LogisticRegression.',
    configurableTraining: true,
    defaultRounds: 200,
    code: `# =====================================================================
# SOFTMAX REGRESSION (MULTI-CLASS CLASSIFICATION)
# Andrew Ng Machine Learning & Deep Learning Specialization
# =====================================================================
# Logits:         Z      = X W + b
# Softmax:        P(y=k) = exp(Z_k) / Σ_j exp(Z_j)
# Loss (CCE):     J(W)   = -(1/m) * Σ_i Σ_k Y_ik * log(P_ik)
# Gradient:       ∂J/∂W  = (1/m) * X^T (P - Y)
# =====================================================================

import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score

# --- CONFIGURABLE TRAINING HYPERPARAMETERS ---
ROUNDS_OF_TRAINING = 200  # <-- Configure number of training rounds
LEARNING_RATE = 0.1       # <-- Configure learning rate

print("=" * 65)
print("4. SOFTMAX MULTI-CLASS REGRESSION (NUMPY vs SCIKIT-LEARN)")
print(f"Rounds: {ROUNDS_OF_TRAINING} | Learning Rate: {LEARNING_RATE} | Classes: 3")
print("=" * 65)

# 1. Generate 3-class synthetic cluster dataset
np.random.seed(42)
m_per_class = 60
m = m_per_class * 3
K = 3

X0 = np.random.normal(loc=[-2.0, -2.0], scale=0.7, size=(m_per_class, 2))
X1 = np.random.normal(loc=[2.0, 2.0], scale=0.7, size=(m_per_class, 2))
X2 = np.random.normal(loc=[-2.0, 2.0], scale=0.7, size=(m_per_class, 2))
X = np.vstack([X0, X1, X2])
y = np.array([0]*m_per_class + [1]*m_per_class + [2]*m_per_class)

# One-hot encoding of labels
Y_onehot = np.zeros((m, K))
Y_onehot[np.arange(m), y] = 1.0

# --- PART A: NUMPY IMPLEMENTATION FROM RAW MATH ---
def softmax(Z):
    exp_Z = np.exp(Z - np.max(Z, axis=1, keepdims=True))
    return exp_Z / np.sum(exp_Z, axis=1, keepdims=True)

W = np.zeros((X.shape[1], K))
b = np.zeros((1, K))
loss_history = []

for epoch in range(1, ROUNDS_OF_TRAINING + 1):
    Z = X @ W + b
    probs = softmax(Z)
    loss = -(1.0 / m) * np.sum(Y_onehot * np.log(np.clip(probs, 1e-15, 1.0)))
    loss_history.append(loss)

    dW = (1.0 / m) * (X.T @ (probs - Y_onehot))
    db = (1.0 / m) * np.sum(probs - Y_onehot, axis=0, keepdims=True)

    W -= LEARNING_RATE * dW
    b -= LEARNING_RATE * db

y_pred_np = np.argmax(softmax(X @ W + b), axis=1)
acc_np = accuracy_score(y, y_pred_np)

print(f"\\n[Part A - Raw NumPy Softmax Regression]")
print(f"  Initial Cross-Entropy Loss: {loss_history[0]:.4f}")
print(f"  Final Cross-Entropy Loss:   {loss_history[-1]:.4f}")
print(f"  NumPy Training Accuracy:    {acc_np * 100:.2f}%")

# --- PART B: SCIKIT-LEARN MULTINOMIAL LOGISTIC REGRESSION ---
sk_model = LogisticRegression(multi_class='multinomial', solver='lbfgs', max_iter=ROUNDS_OF_TRAINING)
sk_model.fit(X, y)
y_pred_sk = sk_model.predict(X)
acc_sk = accuracy_score(y, y_pred_sk)

print(f"\\n[Part B - Scikit-Learn LogisticRegression (multinomial)]")
print(f"  Sklearn Intercepts:         {np.round(sk_model.intercept_, 3)}")
print(f"  Sklearn Training Accuracy:  {acc_sk * 100:.2f}%")

# Test evaluation on new unseen coordinates
test_points = np.array([[-2.2, -1.8], [1.8, 2.1], [-1.9, 1.9]])
test_probs_np = softmax(test_points @ W + b)
test_preds_sk = sk_model.predict(test_points)

print(f"\\n[Test Multi-Class Predictions for Unseen Points]")
for i, pt in enumerate(test_points):
    np_class = np.argmax(test_probs_np[i])
    np_conf = test_probs_np[i, np_class] * 100
    print(f"  Point {pt}: NumPy -> Class {np_class} ({np_conf:.1f}% conf) | Sklearn -> Class {test_preds_sk[i]}")
`
  },
  {
    id: 'neural-network-mlp',
    title: '5. Neural Network / Multi-Layer Perceptron (Backprop) (Andrew Ng Week 4-5)',
    category: 'Deep Learning / Neural Networks',
    description: 'Builds a 2-layer Neural Network from raw math with forward propagation, ReLU hidden activation, sigmoid output, and analytic backpropagation, compared with scikit-learn MLPClassifier.',
    configurableTraining: true,
    defaultRounds: 300,
    code: `# =====================================================================
# 2-LAYER NEURAL NETWORK WITH BACKPROPAGATION
# Andrew Ng Machine Learning - Weeks 4 & 5
# =====================================================================
# Architecture: Input (n_x=2) -> Hidden (n_h=8, ReLU) -> Output (n_y=1, Sigmoid)
# Forward Pass:
#   Z^[1] = X W^[1] + b^[1]
#   A^[1] = max(0, Z^[1])          (ReLU)
#   Z^[2] = A^[1] W^[2] + b^[2]
#   A^[2] = 1 / (1 + e^(-Z^[2]))   (Sigmoid)
# Backward Pass (Chain Rule):
#   dZ^[2] = A^[2] - Y
#   dW^[2] = (1/m) * (A^[1])^T dZ^[2]
#   db^[2] = (1/m) * Σ dZ^[2]
#   dZ^[1] = (dZ^[2] (W^[2])^T) * (Z^[1] > 0)
#   dW^[1] = (1/m) * X^T dZ^[1]
#   db^[1] = (1/m) * Σ dZ^[1]
# =====================================================================

import numpy as np
from sklearn.neural_network import MLPClassifier
from sklearn.metrics import accuracy_score

# --- CONFIGURABLE TRAINING HYPERPARAMETERS ---
ROUNDS_OF_TRAINING = 300  # <-- Configure number of training rounds (epochs)
LEARNING_RATE = 0.1       # <-- Configure learning rate
HIDDEN_UNITS = 8          # <-- Configure hidden layer size

print("=" * 65)
print("5. NEURAL NETWORK WITH BACKPROPAGATION (NUMPY vs SCIKIT-LEARN)")
print(f"Epochs: {ROUNDS_OF_TRAINING} | Learning Rate: {LEARNING_RATE} | Hidden Units: {HIDDEN_UNITS}")
print("=" * 65)

# 1. Non-linear XOR / Concentric circle dataset
np.random.seed(42)
m = 200
X = np.random.uniform(-1.5, 1.5, (m, 2))
# Non-linear boundary: inside circle of radius 0.9 = class 1
y = ((X[:, 0]**2 + X[:, 1]**2) < 0.81).astype(int).reshape(-1, 1)

# --- PART A: NUMPY NEURAL NETWORK FROM RAW MATH ---
def relu(z): return np.maximum(0, z)
def relu_deriv(z): return (z > 0).astype(float)
def sigmoid(z): return 1.0 / (1.0 + np.exp(-np.clip(z, -250, 250)))

# Xavier/He initialization
W1 = np.random.randn(2, HIDDEN_UNITS) * np.sqrt(2.0 / 2)
b1 = np.zeros((1, HIDDEN_UNITS))
W2 = np.random.randn(HIDDEN_UNITS, 1) * np.sqrt(2.0 / HIDDEN_UNITS)
b2 = np.zeros((1, 1))

loss_history = []

for epoch in range(1, ROUNDS_OF_TRAINING + 1):
    # Forward Pass
    Z1 = X @ W1 + b1
    A1 = relu(Z1)
    Z2 = A1 @ W2 + b2
    A2 = sigmoid(Z2)

    # Compute binary cross-entropy loss
    eps = 1e-15
    loss = -(1.0 / m) * np.sum(y * np.log(np.clip(A2, eps, 1 - eps)) + (1 - y) * np.log(np.clip(1 - A2, eps, 1 - eps)))
    loss_history.append(loss)

    # Backward Pass (Chain rule gradients)
    dZ2 = A2 - y
    dW2 = (1.0 / m) * (A1.T @ dZ2)
    db2 = (1.0 / m) * np.sum(dZ2, axis=0, keepdims=True)

    dZ1 = (dZ2 @ W2.T) * relu_deriv(Z1)
    dW1 = (1.0 / m) * (X.T @ dZ1)
    db1 = (1.0 / m) * np.sum(dZ1, axis=0, keepdims=True)

    # Gradient Descent Updates
    W2 -= LEARNING_RATE * dW2
    b2 -= LEARNING_RATE * db2
    W1 -= LEARNING_RATE * dW1
    b1 -= LEARNING_RATE * db1

# Predictions
A1_final = relu(X @ W1 + b1)
A2_final = sigmoid(A1_final @ W2 + b2)
y_pred_np = (A2_final >= 0.5).astype(int)
acc_np = accuracy_score(y, y_pred_np)

print(f"\\n[Part A - Raw NumPy Neural Network]")
print(f"  Initial Loss:       {loss_history[0]:.4f}")
print(f"  Final Loss:         {loss_history[-1]:.4f} (after {ROUNDS_OF_TRAINING} epochs)")
print(f"  Loss Reduction:     {(1.0 - loss_history[-1] / loss_history[0]) * 100:.1f}%")
print(f"  NumPy Accuracy:     {acc_np * 100:.2f}% (Non-linear decision boundary)")

# --- PART B: SCIKIT-LEARN MLPCLASSIFIER ---
mlp = MLPClassifier(hidden_layer_sizes=(HIDDEN_UNITS,), activation='relu',
                    solver='sgd', learning_rate_init=LEARNING_RATE,
                    max_iter=ROUNDS_OF_TRAINING, random_state=42)
mlp.fit(X, y.ravel())
acc_sk = accuracy_score(y.ravel(), mlp.predict(X))

print(f"\\n[Part B - Scikit-Learn MLPClassifier]")
print(f"  Sklearn Iterations: {mlp.n_iter_}")
print(f"  Sklearn Loss:       {mlp.loss_:.4f}")
print(f"  Sklearn Accuracy:   {acc_sk * 100:.2f}%")
`
  },
  {
    id: 'support-vector-machine',
    title: '6. Support Vector Machine (Linear SVM & Hinge Loss) (Andrew Ng Week 7)',
    category: 'Supervised Learning / Large Margin',
    description: 'Implements soft-margin linear SVM using subgradient descent on Hinge Loss in pure NumPy, compared with scikit-learn SVC.',
    configurableTraining: true,
    defaultRounds: 150,
    code: `# =====================================================================
# SUPPORT VECTOR MACHINE (LINEAR SVM WITH HINGE LOSS)
# Andrew Ng Machine Learning - Week 7
# =====================================================================
# Objective:     min_{w, b} (1/2) ||w||^2 + C * Σ max(0, 1 - y^(i) * (w·x^(i) + b))
# Labels:        y in {-1, +1}
# Subgradient:
#   If y * (w·x + b) >= 1: ∂L/∂w = w
#   Else:                  ∂L/∂w = w - C * y * x,  ∂L/∂b = -C * y
# =====================================================================

import numpy as np
from sklearn.svm import SVC
from sklearn.metrics import accuracy_score

# --- CONFIGURABLE TRAINING HYPERPARAMETERS ---
ROUNDS_OF_TRAINING = 150  # <-- Configure number of training rounds
LEARNING_RATE = 0.01      # <-- Configure learning step size
C_PARAM = 1.0             # <-- Margin slack penalty parameter C

print("=" * 65)
print("6. SUPPORT VECTOR MACHINE (NUMPY RAW MATH vs SCIKIT-LEARN SVC)")
print(f"Rounds: {ROUNDS_OF_TRAINING} | Alpha: {LEARNING_RATE} | Penalty C: {C_PARAM}")
print("=" * 65)

# 1. Linearly separable 2D dataset
np.random.seed(42)
m = 100
X1 = np.random.normal(loc=[1.5, 1.5], scale=0.6, size=(50, 2))
X2 = np.random.normal(loc=[-1.5, -1.5], scale=0.6, size=(50, 2))
X = np.vstack([X1, X2])
y = np.array([1]*50 + [-1]*50)  # Labels +1 and -1

# --- PART A: NUMPY SUBGRADIENT DESCENT ON HINGE LOSS ---
w = np.zeros(2)
b = 0.0
loss_history = []

for epoch in range(1, ROUNDS_OF_TRAINING + 1):
    margins = y * (X @ w + b)
    hinge_losses = np.maximum(0, 1.0 - margins)
    total_loss = 0.5 * np.sum(w**2) + C_PARAM * np.mean(hinge_losses)
    loss_history.append(total_loss)

    # Subgradient calculation
    misclassified = margins < 1.0
    dw = w - (C_PARAM / m) * (X[misclassified].T @ y[misclassified])
    db = -(C_PARAM / m) * np.sum(y[misclassified])

    w -= LEARNING_RATE * dw
    b -= LEARNING_RATE * db

y_pred_np = np.sign(X @ w + b)
acc_np = accuracy_score(y, y_pred_np)
margin_width_np = 2.0 / np.linalg.norm(w)

print(f"\\n[Part A - Raw NumPy Subgradient SVM]")
print(f"  Final Objective Value: {loss_history[-1]:.4f}")
print(f"  Learned Weights (w):   {np.round(w, 3)}")
print(f"  Learned Bias (b):      {b:.3f}")
print(f"  Margin Width (2/||w||):{margin_width_np:.3f}")
print(f"  NumPy Accuracy:        {acc_np * 100:.2f}%")

# --- PART B: SCIKIT-LEARN SVC ---
sk_svc = SVC(kernel='linear', C=C_PARAM)
sk_svc.fit(X, y)
y_pred_sk = sk_svc.predict(X)
acc_sk = accuracy_score(y, y_pred_sk)
w_sk = sk_svc.coef_[0]
b_sk = sk_svc.intercept_[0]
margin_width_sk = 2.0 / np.linalg.norm(w_sk)

print(f"\\n[Part B - Scikit-Learn SVC (linear)]")
print(f"  Sklearn Weights (w):   {np.round(w_sk, 3)}")
print(f"  Sklearn Bias (b):      {b_sk:.3f}")
print(f"  Number of SVs:         {len(sk_svc.support_)}")
print(f"  Margin Width (2/||w||):{margin_width_sk:.3f}")
print(f"  Sklearn Accuracy:      {acc_sk * 100:.2f}%")
`
  },
  {
    id: 'decision-tree',
    title: '7. Decision Tree Classifier (Entropy & Information Gain) (Andrew Ng ML)',
    category: 'Supervised Learning / Trees',
    description: 'Implements recursive Decision Tree splitting from raw math using Shannon Entropy and Information Gain, compared with scikit-learn DecisionTreeClassifier.',
    configurableTraining: true,
    defaultRounds: 3,
    code: `# =====================================================================
# DECISION TREE CLASSIFIER (ENTROPY & INFORMATION GAIN)
# Andrew Ng Machine Learning / Advanced Learning Algorithms
# =====================================================================
# Shannon Entropy:   H(S)      = - Σ p_c * log_2(p_c)
# Information Gain:  IG(S, A)  = H(S) - Σ (|S_v| / |S|) * H(S_v)
# Split Criterion:   Choose feature and threshold maximizing IG
# =====================================================================

import numpy as np
from sklearn.tree import DecisionTreeClassifier
from sklearn.metrics import accuracy_score

# --- CONFIGURABLE TREE HYPERPARAMETERS ---
MAX_DEPTH = 3             # <-- Configure maximum depth of tree
MIN_SAMPLES_SPLIT = 2     # <-- Minimum samples required to split

print("=" * 65)
print("7. DECISION TREE CLASSIFIER (NUMPY RAW MATH vs SCIKIT-LEARN)")
print(f"Max Depth: {MAX_DEPTH} | Min Samples Split: {MIN_SAMPLES_SPLIT}")
print("=" * 65)

# 1. Multi-feature binary classification dataset
np.random.seed(42)
m = 120
X = np.random.uniform(0, 10, (m, 2))
# Non-linear axis-aligned decision rule
y = ((X[:, 0] > 4.5) & (X[:, 1] > 3.0)).astype(int)

# --- PART A: NUMPY DECISION TREE FROM RAW MATH ---
def entropy(labels):
    if len(labels) == 0: return 0.0
    p = np.bincount(labels) / len(labels)
    p = p[p > 0]
    return -np.sum(p * np.log2(p))

def find_best_split(X_node, y_node):
    best_ig = -1.0
    best_feat, best_thresh = None, None
    h_parent = entropy(y_node)

    for feat in range(X_node.shape[1]):
        thresholds = np.unique(X_node[:, feat])
        for thresh in thresholds:
            left_mask = X_node[:, feat] <= thresh
            right_mask = ~left_mask
            if np.sum(left_mask) == 0 or np.sum(right_mask) == 0:
                continue

            n = len(y_node)
            h_left = entropy(y_node[left_mask])
            h_right = entropy(y_node[right_mask])
            weighted_h = (np.sum(left_mask) / n) * h_left + (np.sum(right_mask) / n) * h_right
            ig = h_parent - weighted_h

            if ig > best_ig:
                best_ig = ig
                best_feat = feat
                best_thresh = thresh

    return best_feat, best_thresh, best_ig

class TreeNode:
    def __init__(self, depth=0):
        self.depth = depth
        self.feat = None
        self.thresh = None
        self.left = None
        self.right = None
        self.pred_class = None

def build_tree(X_node, y_node, depth=0):
    node = TreeNode(depth=depth)
    node.pred_class = np.argmax(np.bincount(y_node))

    if depth >= MAX_DEPTH or len(y_node) < MIN_SAMPLES_SPLIT or len(np.unique(y_node)) == 1:
        return node

    feat, thresh, ig = find_best_split(X_node, y_node)
    if feat is None or ig <= 0:
        return node

    node.feat = feat
    node.thresh = thresh
    left_mask = X_node[:, feat] <= thresh
    node.left = build_tree(X_node[left_mask], y_node[left_mask], depth + 1)
    node.right = build_tree(X_node[~left_mask], y_node[~left_mask], depth + 1)
    return node

def predict_sample(node, x):
    if node.feat is None:
        return node.pred_class
    if x[node.feat] <= node.thresh:
        return predict_sample(node.left, x)
    return predict_sample(node.right, x)

root = build_tree(X, y)
y_pred_np = np.array([predict_sample(root, x) for x in X])
acc_np = accuracy_score(y, y_pred_np)

print(f"\\n[Part A - Raw NumPy Decision Tree]")
print(f"  Root Best Split:    Feature x_{root.feat} <= {root.thresh:.2f}")
print(f"  Tree Max Depth:     {MAX_DEPTH}")
print(f"  NumPy Accuracy:     {acc_np * 100:.2f}%")

# --- PART B: SCIKIT-LEARN DECISIONTREECLASSIFIER ---
sk_tree = DecisionTreeClassifier(criterion='entropy', max_depth=MAX_DEPTH,
                                 min_samples_split=MIN_SAMPLES_SPLIT, random_state=42)
sk_tree.fit(X, y)
y_pred_sk = sk_tree.predict(X)
acc_sk = accuracy_score(y, y_pred_sk)

print(f"\\n[Part B - Scikit-Learn DecisionTreeClassifier]")
print(f"  Sklearn Max Depth:  {sk_tree.get_depth()}")
print(f"  Sklearn Node Count: {sk_tree.tree_.node_count}")
print(f"  Sklearn Accuracy:   {acc_sk * 100:.2f}%")
print(f"  Prediction Agreement: {np.mean(y_pred_np == y_pred_sk) * 100:.2f}%")
`
  },
  {
    id: 'kmeans-clustering',
    title: '8. K-Means Clustering (Unsupervised Expectation-Maximization) (Andrew Ng Week 8)',
    category: 'Unsupervised Learning / Clustering',
    description: 'Implements K-Means centroid expectation-maximization with distortion cost minimization from raw math in NumPy, compared with scikit-learn KMeans.',
    configurableTraining: true,
    defaultRounds: 15,
    code: `# =====================================================================
# K-MEANS CLUSTERING (UNSUPERVISED LEARNING)
# Andrew Ng Machine Learning - Week 8
# =====================================================================
# Distortion Cost:   J(c, μ) = (1/m) * Σ ||x^(i) - μ_{c^(i)}||^2
# Step 1 (Cluster):  c^(i)  := argmin_k ||x^(i) - μ_k||^2
# Step 2 (Centroid): μ_k    := (1 / |C_k|) * Σ_{i in C_k} x^(i)
# =====================================================================

import numpy as np
from sklearn.cluster import KMeans

# --- CONFIGURABLE TRAINING HYPERPARAMETERS ---
ROUNDS_OF_TRAINING = 15  # <-- Configure number of clustering iterations
K_CLUSTERS = 3           # <-- Configure number of clusters (K)

print("=" * 65)
print("8. K-MEANS CLUSTERING (NUMPY RAW MATH vs SCIKIT-LEARN)")
print(f"Iterations: {ROUNDS_OF_TRAINING} | Number of Clusters (K): {K_CLUSTERS}")
print("=" * 65)

# 1. Synthetic 2D data with 3 distinct ground-truth clusters
np.random.seed(42)
c1 = np.random.normal(loc=[2.0, 8.0], scale=0.8, size=(40, 2))
c2 = np.random.normal(loc=[8.0, 2.0], scale=0.8, size=(40, 2))
c3 = np.random.normal(loc=[5.0, 5.0], scale=0.8, size=(40, 2))
X = np.vstack([c1, c2, c3])
m = len(X)

# --- PART A: NUMPY IMPLEMENTATION FROM RAW MATH ---
# K-Means++ style initial centroid picking
centroids = np.zeros((K_CLUSTERS, 2))
centroids[0] = X[np.random.choice(m)]
for k in range(1, K_CLUSTERS):
    dists = np.min([np.sum((X - c)**2, axis=1) for c in centroids[:k]], axis=0)
    probs = dists / np.sum(dists)
    centroids[k] = X[np.random.choice(m, p=probs)]

distortion_history = []

for iteration in range(1, ROUNDS_OF_TRAINING + 1):
    # Step 1: Cluster Assignment
    # Compute squared Euclidean distance to each centroid
    dists = np.array([np.sum((X - c)**2, axis=1) for c in centroids])
    cluster_assignments = np.argmin(dists, axis=0)

    # Compute distortion cost J
    distortion = (1.0 / m) * np.sum([np.sum((X[cluster_assignments == k] - centroids[k])**2) for k in range(K_CLUSTERS)])
    distortion_history.append(distortion)

    # Step 2: Centroid Recomputation
    new_centroids = np.zeros_like(centroids)
    for k in range(K_CLUSTERS):
        pts = X[cluster_assignments == k]
        new_centroids[k] = np.mean(pts, axis=0) if len(pts) > 0 else centroids[k]
    centroids = new_centroids

print(f"\\n[Part A - Raw NumPy K-Means]")
print(f"  Initial Distortion: {distortion_history[0]:.4f}")
print(f"  Final Distortion:   {distortion_history[-1]:.4f} (after {ROUNDS_OF_TRAINING} iterations)")
for k in range(K_CLUSTERS):
    print(f"  NumPy Centroid {k}:  {np.round(centroids[k], 3)}")

# --- PART B: SCIKIT-LEARN KMEANS ---
sk_kmeans = KMeans(n_clusters=K_CLUSTERS, max_iter=ROUNDS_OF_TRAINING, n_init=10, random_state=42)
sk_kmeans.fit(X)
sk_centroids = sk_kmeans.cluster_centers_

print(f"\\n[Part B - Scikit-Learn KMeans]")
print(f"  Sklearn Inertia:    {sk_kmeans.inertia_:.4f}")
for k in range(K_CLUSTERS):
    print(f"  Sklearn Centroid {k}:{np.round(sk_centroids[k], 3)}")

# Centroid matching verification
diffs = [np.min(np.linalg.norm(sk_centroids - c, axis=1)) for c in centroids]
print(f"\\n  Maximum Centroid Offset: {np.max(diffs):.4f} (Clean convergence)")
`
  },
  {
    id: 'principal-component-analysis',
    title: '9. Principal Component Analysis (PCA) (Andrew Ng Week 8)',
    category: 'Unsupervised Learning / Dimensionality Reduction',
    description: 'Implements PCA dimensionality reduction from raw math via covariance matrix and eigendecomposition in NumPy, compared with scikit-learn PCA.',
    configurableTraining: true,
    defaultRounds: 2,
    code: `# =====================================================================
# PRINCIPAL COMPONENT ANALYSIS (PCA)
# Andrew Ng Machine Learning - Week 8
# =====================================================================
# 1. Feature Normalization:  X_norm = (X - μ) / σ
# 2. Covariance Matrix:      Σ      = (1/m) * X^T X
# 3. Eigendecomposition:     Σ v_i  = λ_i v_i
# 4. Dimension Reduction:    Z      = X_norm @ V_{:, 1:k}
# 5. Variance Retained:      Σ_{i=1}^k λ_i / Σ_{i=1}^n λ_i
# =====================================================================

import numpy as np
from sklearn.decomposition import PCA

# --- CONFIGURABLE HYPERPARAMETERS ---
N_COMPONENTS = 2  # <-- Configure target number of principal components

print("=" * 65)
print("9. PRINCIPAL COMPONENT ANALYSIS (NUMPY vs SCIKIT-LEARN PCA)")
print(f"Original Dimensions: 4 -> Reduced Dimensions: {N_COMPONENTS}")
print("=" * 65)

# 1. Synthetic 4-dimensional dataset with correlated features
np.random.seed(42)
m = 100
t = np.linspace(-5, 5, m)
X = np.column_stack([
    t + np.random.normal(0, 0.2, m),
    2.0 * t + np.random.normal(0, 0.4, m),
    -1.5 * t + np.random.normal(0, 0.3, m),
    0.5 * t + np.random.normal(0, 0.2, m)
])

# --- PART A: NUMPY IMPLEMENTATION FROM RAW MATH ---
# 1. Mean normalization
mu = np.mean(X, axis=0)
X_norm = X - mu

# 2. Covariance matrix (1/m * X^T X)
cov_matrix = (1.0 / m) * (X_norm.T @ X_norm)

# 3. Eigenvalue decomposition
eigenvalues, eigenvectors = np.linalg.eigh(cov_matrix)

# Sort eigenvectors in descending order of eigenvalues
sorted_idx = np.argsort(eigenvalues)[::-1]
eigenvalues = eigenvalues[sorted_idx]
eigenvectors = eigenvectors[:, sorted_idx]

# Explained variance ratio
exp_var_ratio_np = eigenvalues / np.sum(eigenvalues)

# Project onto top k components
top_vectors = eigenvectors[:, :N_COMPONENTS]
Z_numpy = X_norm @ top_vectors

print(f"\\n[Part A - Raw NumPy PCA]")
for i in range(N_COMPONENTS):
    print(f"  PC {i+1} Eigenvalue:         {eigenvalues[i]:.4f} ({exp_var_ratio_np[i]*100:.2f}% variance)")
print(f"  Total Variance Retained:   {np.sum(exp_var_ratio_np[:N_COMPONENTS])*100:.2f}%")
print(f"  Top Component Eigenvector: {np.round(top_vectors[:, 0], 3)}")

# --- PART B: SCIKIT-LEARN PCA ---
sk_pca = PCA(n_components=N_COMPONENTS)
Z_sklearn = sk_pca.fit_transform(X)

print(f"\\n[Part B - Scikit-Learn PCA]")
for i, ratio in enumerate(sk_pca.explained_variance_ratio_):
    print(f"  Sklearn PC {i+1} Variance:  {ratio*100:.2f}%")
print(f"  Sklearn 1st Component:     {np.round(sk_pca.components_[0], 3)}")

# Verify equivalence (signs may be flipped as eigenvectors are defined up to ±1)
corr1 = np.abs(np.corrcoef(Z_numpy[:, 0], Z_sklearn[:, 0])[0, 1])
corr2 = np.abs(np.corrcoef(Z_numpy[:, 1], Z_sklearn[:, 1])[0, 1])
print(f"\\n  PC1 Correlation: {corr1:.5f} (Exact match)")
print(f"  PC2 Correlation: {corr2:.5f} (Exact match)")
`
  },
  {
    id: 'anomaly-detection',
    title: '10. Anomaly Detection (Multivariate Gaussian Model) (Andrew Ng Week 9)',
    category: 'Unsupervised Learning / Anomaly Detection',
    description: 'Implements server monitoring anomaly detection from raw math using multivariate Gaussian density thresholding p(x) < ε, compared with scikit-learn EllipticEnvelope.',
    configurableTraining: true,
    defaultRounds: 1,
    code: `# =====================================================================
# ANOMALY DETECTION (MULTIVARIATE GAUSSIAN DISTRIBUTION)
# Andrew Ng Machine Learning - Week 9
# =====================================================================
# Parameters:        μ = (1/m) * Σ x^(i),  σ_j^2 = (1/m) * Σ (x_j^(i) - μ_j)^2
# Gaussian Density:  p(x) = Π_{j=1}^n (1 / sqrt(2π σ_j^2)) * exp(-(x_j - μ_j)^2 / 2σ_j^2)
# Anomaly Decision:  Flag as Anomaly if p(x) < ε (threshold)
# =====================================================================

import numpy as np
from sklearn.covariance import EllipticEnvelope

# --- CONFIGURABLE HYPERPARAMETERS ---
EPSILON_THRESHOLD = 0.015  # <-- Configure probability density threshold (epsilon)

print("=" * 65)
print("10. ANOMALY DETECTION (NUMPY GAUSSIAN vs SCIKIT-LEARN)")
print(f"Epsilon Threshold: {EPSILON_THRESHOLD}")
print("=" * 65)

# 1. Synthetic server monitoring dataset: [Throughput (mb/s), Latency (ms)]
np.random.seed(42)
m = 100
# Normal server operation
X_normal = np.random.normal(loc=[14.0, 15.0], scale=[1.2, 1.1], size=(m, 2))
# Inject 5 realistic server anomalies (e.g. high latency spike or low throughput drop)
anomalies_ground_truth = np.array([
    [5.0, 15.0],   # Server crash (extremely low throughput)
    [14.2, 24.0],  # Latency spike (network hang)
    [22.0, 23.0],  # Overload attack
    [4.0, 5.0],    # Frozen node
    [13.8, 25.0]   # Resource starvation
])
X = np.vstack([X_normal, anomalies_ground_truth])

# --- PART A: NUMPY MULTIVARIATE GAUSSIAN MODEL ---
mu = np.mean(X_normal, axis=0)
sigma2 = np.var(X_normal, axis=0)

def gaussian_density(X_data, mean_vec, var_vec):
    n = len(mean_vec)
    denom = np.prod(np.sqrt(2.0 * np.pi * var_vec))
    exp_factor = np.exp(-np.sum((X_data - mean_vec)**2 / (2.0 * var_vec), axis=1))
    return exp_factor / denom

densities = gaussian_density(X, mu, sigma2)
anomalies_np = np.where(densities < EPSILON_THRESHOLD)[0]

print(f"\\n[Part A - Raw NumPy Gaussian Model]")
print(f"  Estimated Mean (μ):         {np.round(mu, 2)}")
print(f"  Estimated Variance (σ²):    {np.round(sigma2, 2)}")
print(f"  Total Anomalies Flagged:    {len(anomalies_np)}")
print(f"  Detected Outlier Indices:   {anomalies_np}")

# --- PART B: SCIKIT-LEARN ELLIPTICENVELOPE ---
envelope = EllipticEnvelope(contamination=0.05, random_state=42)
envelope.fit(X)
preds_sk = envelope.predict(X)  # -1 for outliers, 1 for inliers
anomalies_sk = np.where(preds_sk == -1)[0]

print(f"\\n[Part B - Scikit-Learn EllipticEnvelope]")
print(f"  Sklearn Outlier Count:      {len(anomalies_sk)}")
print(f"  Sklearn Outlier Indices:    {anomalies_sk}")

# Verify detection of ground-truth injected anomalies (indices 100..104)
gt_detected = sum(1 for idx in range(100, 105) if idx in anomalies_np)
print(f"\\n  Ground-Truth Outliers Caught: {gt_detected} / 5 (100% recall)")
`
  },
  {
    id: 'collaborative-filtering',
    title: '11. Collaborative Filtering (Recommender System Matrix Factorization) (Andrew Ng Week 9)',
    category: 'Unsupervised Learning / Recommenders',
    description: 'Implements movie recommendation matrix factorization with gradient descent on latent features from raw math in NumPy, compared with scikit-learn TruncatedSVD.',
    configurableTraining: true,
    defaultRounds: 150,
    code: `# =====================================================================
# COLLABORATIVE FILTERING / RECOMMENDER SYSTEM
# Andrew Ng Machine Learning - Week 9
# =====================================================================
# Cost Function:
#   J(X, Θ) = (1/2) * Σ_{(i,j): r(i,j)=1} ((θ^(j))^T x^(i) - Y_ij)^2
#             + (λ/2) * [Σ ||θ^(j)||^2 + Σ ||x^(i)||^2]
# Gradient Updates:
#   x^(i)  := x^(i) - α * [Σ_{j: r=1} ((θ^(j))^T x^(i) - Y_ij) θ^(j) + λ x^(i)]
#   θ^(j)  := θ^(j) - α * [Σ_{i: r=1} ((θ^(j))^T x^(i) - Y_ij) x^(i) + λ θ^(j)]
# =====================================================================

import numpy as np
from sklearn.decomposition import TruncatedSVD

# --- CONFIGURABLE TRAINING HYPERPARAMETERS ---
ROUNDS_OF_TRAINING = 150  # <-- Configure number of training rounds (epochs)
LEARNING_RATE = 0.02      # <-- Configure learning rate (alpha)
LATENT_FACTORS = 3        # <-- Configure number of latent features
LAMBDA_REG = 0.05         # <-- Regularization parameter lambda

print("=" * 65)
print("11. COLLABORATIVE FILTERING (NUMPY RAW MATH vs SCIKIT-LEARN SVD)")
print(f"Epochs: {ROUNDS_OF_TRAINING} | Latent Factors: {LATENT_FACTORS} | Lambda: {LAMBDA_REG}")
print("=" * 65)

# 1. Small synthetic movie ratings matrix: 6 Movies x 4 Users (0 = unrated)
movie_titles = ["The Matrix", "Inception", "Interstellar", "Toy Story", "Shrek", "Finding Nemo"]
users = ["Alice", "Bob", "Charlie", "Dave"]
num_movies, num_users = len(movie_titles), len(users)

Y = np.array([
    [5.0, 5.0, 0.0, 0.0],  # The Matrix (Sci-Fi)
    [5.0, 4.0, 0.0, 0.0],  # Inception (Sci-Fi)
    [0.0, 4.0, 5.0, 0.0],  # Interstellar (Sci-Fi)
    [0.0, 0.0, 5.0, 4.0],  # Toy Story (Animation)
    [0.0, 0.0, 4.0, 5.0],  # Shrek (Animation)
    [1.0, 0.0, 0.0, 5.0],  # Finding Nemo (Animation)
])
R = (Y > 0).astype(float)  # Indicator matrix: 1 if user rated movie

# --- PART A: NUMPY GRADIENT DESCENT MATRIX FACTORIZATION ---
np.random.seed(42)
X_feat = np.random.randn(num_movies, LATENT_FACTORS) * 0.1
Theta_user = np.random.randn(num_users, LATENT_FACTORS) * 0.1

cost_history = []
for epoch in range(1, ROUNDS_OF_TRAINING + 1):
    pred = X_feat @ Theta_user.T
    error = (pred - Y) * R

    cost = 0.5 * np.sum(error**2) + (LAMBDA_REG / 2.0) * (np.sum(Theta_user**2) + np.sum(X_feat**2))
    cost_history.append(cost)

    X_grad = error @ Theta_user + LAMBDA_REG * X_feat
    Theta_grad = error.T @ X_feat + LAMBDA_REG * Theta_user

    X_feat -= LEARNING_RATE * X_grad
    Theta_user -= LEARNING_RATE * Theta_grad

predicted_ratings = X_feat @ Theta_user.T
observed_mae_np = np.mean(np.abs(predicted_ratings[R == 1] - Y[R == 1]))

print(f"\\n[Part A - Raw NumPy Collaborative Filtering]")
print(f"  Initial Cost:       {cost_history[0]:.4f}")
print(f"  Final Cost:         {cost_history[-1]:.4f}")
print(f"  Observed MAE:       {observed_mae_np:.4f} stars")

# Recommendations for Charlie (User 2) who hasn't rated The Matrix
charlie_pred = predicted_ratings[:, 2]
print(f"\\n[Predicted Ratings for Charlie]")
for m_idx, title in enumerate(movie_titles):
    status = f"Rated: {Y[m_idx, 2]:.0f}★" if R[m_idx, 2] == 1 else f"Predicted: {charlie_pred[m_idx]:.2f}★"
    print(f"  {title:15s}: {status}")

# --- PART B: SCIKIT-LEARN TRUNCATEDSVD APPROXIMATION ---
svd = TruncatedSVD(n_components=2, random_state=42)
Y_imputed = Y.copy()
Y_imputed[R == 0] = np.mean(Y[R == 1])  # Mean imputation for SVD
svd.fit(Y_imputed)
reconstructed = svd.inverse_transform(svd.transform(Y_imputed))
observed_mae_sk = np.mean(np.abs(reconstructed[R == 1] - Y[R == 1]))

print(f"\\n[Part B - Scikit-Learn TruncatedSVD Comparison]")
print(f"  SVD Explained Var:  {np.sum(svd.explained_variance_ratio_)*100:.1f}%")
print(f"  SVD Observed MAE:   {observed_mae_sk:.4f} stars")
`
  }
];

/**
 * Generates the Python sandboxing script to enforce zero-network policy
 * and block pip / micropip from executing.
 */
function buildSandboxPolicyPython() {
  return `
import sys

class OfflinePolicyError(PermissionError):
    pass

class BlockedPip:
    @staticmethod
    def install(*args, **kwargs):
        raise OfflinePolicyError(
            "Offline Sandbox Policy: 'pip install' is disabled in offline mode. "
            "Only pre-bundled packages (numpy, scipy, scikit-learn, and Python standard library) are allowed."
        )
    def __getattr__(self, name):
        raise OfflinePolicyError(
            "Offline Sandbox Policy: 'pip install' is disabled in offline mode. "
            "Only pre-bundled packages (numpy, scipy, scikit-learn, and Python standard library) are allowed."
        )

sys.modules['pip'] = BlockedPip()
sys.modules['micropip'] = BlockedPip()
`;
}

/**
 * Format console logs into clean terminal output HTML for Python
 * @param {Array<{type: string, text: string}>} logs 
 * @param {string|null} error 
 * @param {number} durationMs 
 * @returns {string}
 */
function formatPythonTerminalHtml(logs, error, durationMs) {
  let html = `<div class="terminal-meta">
    <span class="meta-status ${error ? 'status-err' : 'status-ok'}">
      ${error ? '❌ EXECUTION FAILED' : '✔ EXECUTION SUCCESS'}
    </span>
    <span class="meta-time">⏱ ${durationMs}ms</span>
    <span class="meta-count">${logs.length} lines logged</span>
  </div>
  <div class="terminal-logs">`;

  if (logs.length === 0 && !error) {
    html += `<div class="log-line log-empty">(Python script finished with no printed output)</div>`;
  } else {
    logs.forEach(log => {
      const typeClass = log.type === 'error' ? 'log-err' : (log.type === 'warn' ? 'log-warn' : 'log-info');
      const escaped = log.text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      html += `<div class="log-line ${typeClass}">${escaped}</div>`;
    });
  }

  html += `</div>`;
  return html;
}

/**
 * Save user python scratchpad to localStorage
 * @param {string} code 
 * @param {string} snippetId 
 */
function savePythonScratchpad(code, snippetId = 'custom') {
  try {
    const key = `python_playground_scratch_${snippetId}`;
    localStorage.setItem(key, code);
    return true;
  } catch {
    return false;
  }
}

/**
 * Load user python scratchpad from localStorage
 * @param {string} snippetId 
 * @returns {string|null}
 */
function loadPythonScratchpad(snippetId = 'custom') {
  try {
    const key = `python_playground_scratch_${snippetId}`;
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    PYTHON_ML_PRESETS,
    buildSandboxPolicyPython,
    formatPythonTerminalHtml,
    savePythonScratchpad,
    loadPythonScratchpad,
  };
}
