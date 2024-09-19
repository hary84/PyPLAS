import asyncio
import argparse

from pyplas.app import starter

if __name__ == "__main__":
    # parse command-line argment
    parser = argparse.ArgumentParser(description="PyPLAS server options")
    parser.add_argument("-p", "--port", default=8888, type=str, help="Port number to run the server on")
    parser.add_argument("-d", "--develop", action="store_true", help="Run the server in developer mode")
    args = parser.parse_args()

    asyncio.run(starter(port=args.port, develop=args.develop))