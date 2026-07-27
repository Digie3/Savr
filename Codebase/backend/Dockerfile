FROM node:22-bookworm

# Install Java 21, Python, other tools
RUN apt-get update && apt-get install -y \
    openjdk-17-jdk \
    python3 \
    python3-pip \
    wget \
    tar \
    procps \
    && rm -rf /var/lib/apt/lists/*

# Install Apache Spark 4.1.0
RUN wget https://archive.apache.org/dist/spark/spark-4.1.0/spark-4.1.0-bin-hadoop3.tgz \
 && tar -xzf spark-4.1.0-bin-hadoop3.tgz -C /opt \
 && mv /opt/spark-4.1.0-bin-hadoop3 /opt/spark \
 && rm spark-4.1.0-bin-hadoop3.tgz

# Create a portable JAVA_HOME link
RUN ln -sf "$(dirname "$(dirname "$(readlink -f "$(which java)")")")" /usr/lib/jvm/default-java

ENV JAVA_HOME=/usr/lib/jvm/default-java
ENV SPARK_HOME=/opt/spark
ENV PATH="${JAVA_HOME}/bin:${SPARK_HOME}/bin:${PATH}"

WORKDIR /backend

# Install PySpark + Delta Lake
RUN pip3 install --break-system-packages --no-cache-dir \
    pyspark==4.1.0 \
    delta-spark==4.2.0

# Install Node
COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 4000

CMD ["npm", "start"]