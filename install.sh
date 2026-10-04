#!/bin/bash

echo "🎥 YouTube Video Downloader - Installation Script"
echo "================================================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 16+ from https://nodejs.org/"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js $(node -v) detected"

# Check if npm is available
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not available"
    exit 1
fi

echo "✅ npm $(npm -v) detected"

if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3.9+ is required by yt-dlp on macOS/Linux. Install Python 3 and retry."
    exit 1
fi

PYTHON_VERSION=$(python3 -c 'import sys; print(sys.version_info.major * 100 + sys.version_info.minor)')
if [ "$PYTHON_VERSION" -lt 309 ]; then
    echo "❌ Python 3.9+ is required. Current version: $(python3 --version)"
    exit 1
fi

echo "✅ Python $(python3 --version) detected"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

if [ $? -eq 0 ]; then
    echo "✅ Dependencies installed successfully"
    echo ""
    echo "🚀 To start the application, run:"
    echo "   npm start"
    echo ""
    echo "📚 For more information, see README.md"
else
    echo "❌ Failed to install dependencies"
    exit 1
fi
