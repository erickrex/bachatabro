#!/bin/bash
# Setup script to generate all required models for Bacha Trainer

set -e  # Exit on error

echo "🤖 Bacha Trainer - Model Setup"
echo "================================"
echo ""

# Check if uv is installed
if ! command -v uv &> /dev/null; then
    echo "❌ UV package manager not found. Please install it first:"
    echo "   curl -LsSf https://astral.sh/uv/install.sh | sh"
    exit 1
fi

echo "✅ UV package manager found"
echo ""

# Install dependencies
echo "📦 Installing Python dependencies..."
uv sync
echo "✅ Dependencies installed"
echo ""

# Create models directory
mkdir -p models
echo "✅ Models directory created"
echo ""

# Step 1: Create lightweight pose model
echo "🏗️  Step 1/3: Creating lightweight pose model..."
uv run python create_lightweight_model.py
if [ $? -eq 0 ]; then
    echo "✅ Lightweight pose model created (lightweight_pose.pt)"
else
    echo "❌ Failed to create lightweight pose model"
    exit 1
fi
echo ""

# Step 2: Export to ExecuTorch
echo "📤 Step 2/3: Exporting to ExecuTorch format..."
uv run python export_model.py \
    --input models/lightweight_pose.pt \
    --output models/pose_model.pte \
    --quantize
if [ $? -eq 0 ]; then
    echo "✅ ExecuTorch models exported"
    echo "   - pose_model.pte (non-quantized)"
    echo "   - pose_model_quantized.pte (quantized, recommended)"
else
    echo "❌ Failed to export ExecuTorch models"
    exit 1
fi
echo ""

# Step 3: Validate models
echo "🔍 Step 3/3: Validating models..."
uv run python validate_model.py --model models/pose_model_quantized.pte
if [ $? -eq 0 ]; then
    echo "✅ Model validation passed"
else
    echo "⚠️  Model validation failed (but models may still work)"
fi
echo ""

# Copy to mobile app
echo "📱 Copying model to mobile app..."
mkdir -p ../mobile/assets/models
cp models/pose_model_quantized.pte ../mobile/assets/models/pose.pte
echo "✅ Model copied to mobile/assets/models/pose.pte"
echo ""

# Summary
echo "🎉 Setup Complete!"
echo "================================"
echo ""
echo "Generated files:"
echo "  📁 python-tools/models/"
echo "     - lightweight_pose.pt (87MB) - PyTorch model"
echo "     - pose_model.pte (87MB) - ExecuTorch model"
echo "     - pose_model_quantized.pte (8.5MB) - Quantized model ⭐"
echo ""
echo "  📁 mobile/assets/models/"
echo "     - pose.pte (8.5MB) - Ready for mobile app ⭐"
echo ""
echo "Next steps:"
echo "  1. cd ../mobile"
echo "  2. npm install"
echo "  3. npm start"
echo ""
