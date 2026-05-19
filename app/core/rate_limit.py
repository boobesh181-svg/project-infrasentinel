from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)


def is_rate_limit_exempt(request) -> bool:
	client = getattr(request, "client", None)
	host = getattr(client, "host", None)
	return host == "testclient"
