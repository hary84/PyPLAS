# Use an official Python base image
FROM python:3.9.18-slim

# Install SQLite 3.45
RUN apt-get update && \
    apt-get install --no-install-recommends -y wget build-essential  && \
    wget https://www.sqlite.org/2024/sqlite-autoconf-3450300.tar.gz && \
    tar xzf sqlite-autoconf-3450300.tar.gz && \
    cd sqlite-autoconf-3450300 && \
    ./configure --prefix=/usr/local && \
    make && \
    make install && \
    cd .. && \
    rm -rf sqlite-autoconf-3450300 sqlite-autoconf-3450300.tar.gz && \
    apt-get remove -y wget build-essential && \
    apt-get autoremove -y && \
    apt-get clean

# Verify installations
RUN python --version && \
    sqlite3 --version

# Set the working directory
WORKDIR /app

# # Copy the current directory contents into the container at /app
COPY . /app

# # Install any needed packages specified in requirements.txt
RUN pip install -U pip && \
    pip install --no-cache-dir -r requirements.txt

# # Make port 80 available to the world outside this container
EXPOSE 8888

# # Run app.py when the container launches
ENTRYPOINT ["python", "run.py"]
CMD []
