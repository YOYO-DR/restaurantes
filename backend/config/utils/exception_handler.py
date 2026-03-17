from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status
from django.db import IntegrityError
import logging
import sys

# Usar el logger de django para asegurar que salga en los logs configurados
logger = logging.getLogger('django')


def custom_exception_handler(exc, context):
    """
    Fuerza respuestas JSON para APIs DRF incluso en errores 500
    """

    # Primero deja que DRF maneje lo que sabe manejar
    response = exception_handler(exc, context)

    if response is not None:
        return response

    # Excepciones no controladas → 500 JSON
    
    # Loguear el error antes de devolver la respuesta genérica
    error_msg = f"Unhandled exception in {context['view'].__class__.__name__}: {exc}"
    logger.error(error_msg, exc_info=True)
    print(error_msg, file=sys.stderr) # Fallback a stderr

    if isinstance(exc, IntegrityError):
        return Response(
            {"detail": "Internal Server Error"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    return Response(
        {"detail": "Internal Server Error"},
        status=status.HTTP_500_INTERNAL_SERVER_ERROR,
    )
