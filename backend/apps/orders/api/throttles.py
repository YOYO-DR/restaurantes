from rest_framework.throttling import SimpleRateThrottle


class CheckoutOrderRateThrottle(SimpleRateThrottle):
    scope = "checkout_authenticated"

    def get_cache_key(self, request, view):
        if request.user and request.user.is_authenticated:
            self.scope = "checkout_authenticated"
            ident = str(request.user.id)
        else:
            self.scope = "checkout_guest"
            ident = self.get_ident(request)

        return self.cache_format % {"scope": self.scope, "ident": ident}
