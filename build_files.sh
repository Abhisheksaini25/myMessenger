#!/bin/bash
echo "Installing requirements..."
pip install -r requirements.txt

echo "Collecting static files..."
python3 manage.py collectstatic --noinput --clear