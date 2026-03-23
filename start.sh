#!/bin/bash

# OpenClaw Dashboard
# Development server starter

set -e

cd "$(dirname "$0")"

echo "⚡ OpenClaw Dashboard"
echo ""

# Check if ports are in use
if lsof -Pi :3001 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "⚠️  Port 3001 in use, killing..."
    kill $(lsof -t -i:3001) 2>/dev/null || true
    sleep 1
fi

if lsof -Pi :5173 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "⚠️  Port 5173 in use, killing..."
    kill $(lsof -t -i:5173) 2>/dev/null || true
    sleep 1
fi

# Install dependencies if needed
if [ ! -d "backend/node_modules" ]; then
    echo "📦 Installing backend dependencies..."
    cd backend && npm install --silent && cd ..
fi

if [ ! -d "frontend/node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    cd frontend && npm install --silent && cd ..
fi

# Start servers
echo "🚀 Starting servers..."
echo ""

cd backend
node server.js &
BACKEND_PID=$!
cd ..

sleep 2

cd frontend
npm run dev -- --host &
FRONTEND_PID=$!
cd ..

echo ""
echo "✅ Dashboard ready!"
echo ""
echo "   🌐 App:  http://localhost:5173"
echo "   📡 API:  http://localhost:3001"
echo ""
echo "Press Ctrl+C to stop"
echo ""

# Cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Shutting down..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    exit 0
}

trap cleanup SIGINT SIGTERM

# Wait for processes
wait
