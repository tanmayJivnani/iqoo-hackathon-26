@echo off
title Cloudflare Tunnel - Pune Tree Rakshak
echo ==============================================================
echo   Starting Cloudflare Tunnel for Pune Tree Rakshak Backend
echo   Forwarding: http://127.0.0.1:8000
echo ==============================================================
echo.
"%~dp0tools\cloudflared.exe" tunnel --url http://127.0.0.1:8000
pause
