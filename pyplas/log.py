import logging

class CustomFormatter(logging.Formatter):

    def __init__(self, use_color:bool=True):
        self.use_color = use_color

    grey = "\x1b[38;20m"
    blue = "\x1b[34m"
    yellow = "\x1b[33;20m"
    red = "\x1b[31;20m"
    bold_red = "\x1b[31;1m"
    reset = "\x1b[0m"
    fmt = "%(levelname)-9s  %(asctime)s [%(filename)s:%(lineno)-4d] %(message)s"

    FORMATS = {
        logging.DEBUG: grey + fmt + reset,
        logging.INFO: blue + fmt + reset,
        logging.WARNING: yellow + fmt + reset,
        logging.ERROR: red + fmt + reset,
        logging.CRITICAL: bold_red + fmt + reset
    }

    def format(self, record):
        if (self.use_color):
            log_fmt = self.FORMATS.get(record.levelno)
            formatter = logging.Formatter(log_fmt)
            return formatter.format(record)
        else:
            formatter =  logging.Formatter(self.fmt)
            return formatter.format(record)

def get_logger(use_color:bool=True):
    logger = logging.getLogger(__name__)
    logger.setLevel(logging.DEBUG)

    ch = logging.StreamHandler()
    ch.setLevel(logging.DEBUG)
    ch.setFormatter(CustomFormatter(use_color))

    logger.addHandler(ch)

    return logger


if __name__ == "__main__":
    mylogger = get_logger()

    try:
        1 / 0 
    except Exception as e:
        mylogger.error(e, exc_info=True)