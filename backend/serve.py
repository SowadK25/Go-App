"""Production entry point for Railway and local container smoke checks."""
import os

import uvicorn


def main():
    trusted_proxies = os.getenv("FORWARDED_ALLOW_IPS", "").strip()
    if "*" in {item.strip() for item in trusted_proxies.split(",")}:
        raise RuntimeError("FORWARDED_ALLOW_IPS must list trusted proxy addresses, not '*'.")

    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", "8000")),
        workers=1,
        proxy_headers=bool(trusted_proxies),
        forwarded_allow_ips=trusted_proxies,
    )


if __name__ == "__main__":
    main()
