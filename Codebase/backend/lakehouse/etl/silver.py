import os

from pyspark.sql.functions import col, trim, upper
from spark_session import spark

# --------------------------------------------------
# Paths
# --------------------------------------------------

BASE = os.path.dirname(__file__)

PROJECT_ROOT = os.path.abspath(
    os.path.join(BASE, "..", "..", "..", "..")
)

BRONZE = os.path.join(
    PROJECT_ROOT,
    "Codebase",
    "backend",
    "lakehouse",
    "data",
    "bronze"
)

SILVER = os.path.join(
    PROJECT_ROOT,
    "Codebase",
    "backend",
    "lakehouse",
    "data",
    "silver"
)

os.makedirs(SILVER, exist_ok=True)

# --------------------------------------------------
# USERS
# --------------------------------------------------

users = spark.read.format("delta").load(
    os.path.join(BRONZE, "users")
)

users_clean = (
    users
    .dropDuplicates()
    .withColumn("username", trim(col("username")))
)

users_clean.write \
    .format("delta") \
    .mode("overwrite") \
    .save(os.path.join(SILVER, "users_clean"))

print("Users cleaned.")

# --------------------------------------------------
# RECIPES
# --------------------------------------------------

recipes = spark.read.format("delta").load(
    os.path.join(BRONZE, "recipes")
)

recipes_clean = (
    recipes
    .dropDuplicates()
    .filter(col("title").isNotNull())
)

recipes_clean.write \
    .format("delta") \
    .mode("overwrite") \
    .save(os.path.join(SILVER, "recipes_clean"))

print("Recipes cleaned.")

# --------------------------------------------------
# COMMENTS
# --------------------------------------------------

comments = spark.read.format("delta").load(
    os.path.join(BRONZE, "comments")
)

comments_clean = (
    comments
    .dropDuplicates()
)

comments_clean.write \
    .format("delta") \
    .mode("overwrite") \
    .save(os.path.join(SILVER, "comments_clean"))

print("Comments cleaned.")

# --------------------------------------------------
# RATINGS
# --------------------------------------------------

ratings = spark.read.format("delta").load(
    os.path.join(BRONZE, "ratings")
)

ratings_clean = (
    ratings
    .dropDuplicates()
    .filter(col("num_stars").between(1, 5))
)

ratings_clean.write \
    .format("delta") \
    .mode("overwrite") \
    .save(os.path.join(SILVER, "ratings_clean"))

print("Ratings cleaned.")

# --------------------------------------------------
# ACTIVITY EVENTS
# --------------------------------------------------

activity = spark.read.format("delta").load(
    os.path.join(BRONZE, "activity_events")
)

activity_clean = (
    activity
    .dropDuplicates()
)

activity_clean.write \
    .format("delta") \
    .mode("overwrite") \
    .save(os.path.join(SILVER, "activity_clean"))

print("Activity cleaned.")

# --------------------------------------------------
# RECIPE DETAILS
# --------------------------------------------------

recipe_details = (
    recipes_clean.alias("r")
    .join(
        users_clean.alias("u"),
        col("r.Users_idUsers") == col("u.idUsers"),
        "left"
    )
    .select(
        col("r.idRecipes").alias("recipe_id"),
        col("r.title"),
        col("r.description"),
        col("r.prep_time"),
        col("r.cooking_time"),
        col("r.num_servings"),
        col("r.date_posted"),
        col("u.username").alias("creator")
    )
)

recipe_details.write \
    .format("delta") \
    .mode("overwrite") \
    .save(os.path.join(SILVER, "recipe_details"))

print("Recipe details created.")

print("\nSilver layer successfully created.")