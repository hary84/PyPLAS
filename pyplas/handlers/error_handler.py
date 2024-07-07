from .app_handler import ApplicationHandler

class ErrorHandler(ApplicationHandler): 
    """
    For 404 errors, use in the default_handler_class, Application setting.
    """
    def prepare(self):
        self.write_error(status_code=404)
