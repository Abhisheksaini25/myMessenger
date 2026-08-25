#!/bin/bash
echo "Installing requirements..."
python3 -m pip install -r requirements.txt --break-system-packages

echo "Collecting static files..."
python3 manage.py collectstatic --noinput --clear

echo "Moving static files for Vercel CDN..."
mkdir -p staticfiles_build/static
mv staticfiles/* staticfiles_build/static/