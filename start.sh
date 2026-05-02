#!/usr/bin/env bash
# LURKHOUND — Linux/macOS Quick Start
set -e

echo "🐕 LURKHOUND — Active Directory Attack-Path Discovery Mapper"
echo "============================================================="

# Check Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 not found. Install Python 3.10+ first."
    exit 1
fi

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Install Node.js 18+ first."
    exit 1
fi

# Install Python dependencies
echo "📦 Installing Python dependencies..."
pip3 install -r requirements.txt --quiet

# Install frontend dependencies
echo "📦 Installing frontend dependencies..."
cd frontend-next
npm install --silent
cd ..

# Create data directory
mkdir -p data

# Create .env if missing
if [ ! -f .env ]; then
    echo "📝 Creating default .env..."
    cat > .env << 'EOF'
API_PORT=8000
LOG_LEVEL=info
SESSION_TTL_MINUTES=30
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,http://localhost:8000,http://127.0.0.1:8000
LDAP_TLS_VERIFY=false
EOF
fi

echo ""
echo "🚀 Starting LURKHOUND..."
echo "   Backend:  http://localhost:8000"
echo "   Frontend: http://localhost:3000"
echo ""

# Start backend in background
cd backend
python3 main.py &
BACKEND_PID=$!
cd ..

# Start frontend
cd frontend-next
npm run dev &
FRONTEND_PID=$!
cd ..

# Trap Ctrl+C to kill both
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM

echo "Press Ctrl+C to stop."
wait
