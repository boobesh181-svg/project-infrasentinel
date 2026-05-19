from __future__ import annotations

import logging
from logging.config import dictConfig


LOGGING_CONFIG = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "standard": {
            "format": "%(asctime)s %(levelname)s %(name)s %(message)s",
            "datefmt": "%Y-%m-%dT%H:%M:%S%z",
        }
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "standard",
            "level": "INFO",
        }
    },
    "loggers": {
        "": {"handlers": ["console"], "level": "INFO"},
        "uvicorn": {"handlers": ["console"], "level": "INFO", "propagate": False},
        "infrasentinel": {"handlers": ["console"], "level": "INFO", "propagate": False},
    },
}


def configure_logging() -> None:
    dictConfig(LOGGING_CONFIG)
    logging.getLogger("infrasentinel").info("logging configured")
