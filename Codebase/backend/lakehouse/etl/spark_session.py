import pyspark
from delta import configure_spark_with_delta_pip

# Initialize the Spark Session builder
builder = pyspark.sql.SparkSession.builder \
    .appName("DeltaLakehouse") \
    .config("spark.sql.extensions", "io.delta.sql.DeltaSparkSessionExtension") \
    .config("spark.sql.catalog.spark_catalog", "org.apache.spark.sql.delta.catalog.DeltaCatalog")

# Inject Delta-specific JAR dependencies and create the session
spark = configure_spark_with_delta_pip(builder).getOrCreate()

# Hide Spark INFO/WARN logs
spark.sparkContext.setLogLevel("ERROR")

# Hide Ivy dependency resolution logs
spark.sparkContext._jvm.org.apache.ivy.util.Message.setDefaultLogger(
    spark.sparkContext._jvm.org.apache.ivy.util.DefaultMessageLogger(0)
)