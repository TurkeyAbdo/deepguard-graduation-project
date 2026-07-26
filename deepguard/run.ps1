$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path

Start-Process -FilePath "$Root\.venv\Scripts\python.exe" `
  -ArgumentList "-m", "uvicorn", "server.app:app", "--host", "127.0.0.1", "--port", "8000", "--reload" `
  -WorkingDirectory $Root `
  -WindowStyle Hidden

& "C:\Users\Lenovo\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd" dev
