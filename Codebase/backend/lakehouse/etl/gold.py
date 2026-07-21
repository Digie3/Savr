import os
from pyspark.sql.window import Window
from pyspark.sql.functions import row_number
from pyspark.sql.functions import (
    avg,
    count,
    max,
    sum,
    when,
    col
)
from spark_session import spark

# --------------------------------------------------
# Paths
# --------------------------------------------------

BASE = os.path.dirname(__file__)

PROJECT_ROOT = os.path.abspath(
    os.path.join(BASE, "..", "..", "..", "..")
)

SILVER = os.path.join(
    PROJECT_ROOT,
    "Codebase",
    "backend",
    "lakehouse",
    "data",
    "silver"
)

GOLD = os.path.join(
    PROJECT_ROOT,
    "Codebase",
    "backend",
    "lakehouse",
    "data",
    "gold"
)

os.makedirs(GOLD, exist_ok=True)

# --------------------------------------------------
# Load Silver Tables
# --------------------------------------------------

recipes = spark.read.format("delta").load(
    os.path.join(SILVER, "recipe_details")
)

ratings = spark.read.format("delta").load(
    os.path.join(SILVER, "ratings_clean")
)

comments = spark.read.format("delta").load(
    os.path.join(SILVER, "comments_clean")
)

activity = spark.read.format("delta").load(
    os.path.join(SILVER, "activity_clean")
)

# --------------------------------------------------
# Creator Metrics
# --------------------------------------------------

# Views per recipe
recipe_views = (
    activity
    .filter(
        (col("event_type") == "recipe_view") &
        (col("entity_type") == "recipe")
    )
    .groupBy("entity_id")
    .agg(
        count("*").alias("view_count")
    )
)

creator_metrics = (
    recipes.alias("r")
    .join(
        ratings.groupBy("Recipes_idRecipes")
        .agg(
            count("*").alias("ratings_received")
        )
        .alias("ra"),
        col("r.recipe_id") == col("ra.Recipes_idRecipes"),
        "left"
    )
    .join(
        comments.groupBy("Recipes_idRecipes")
        .agg(
            count("*").alias("comments_received")
        )
        .alias("co"),
        col("r.recipe_id") == col("co.Recipes_idRecipes"),
        "left"
    )
    .join(
    recipe_views.alias("rv"),
    col("r.recipe_id").cast("string") == col("rv.entity_id"),
    "left"
    )
    .fillna({
        "ratings_received": 0,
        "comments_received": 0,
        "view_count": 0
    })

    .groupBy("creator")

    .agg(
        count("*").alias("total_recipes_published"),
        sum("ratings_received").alias("total_ratings_received"),
        sum("comments_received").alias("total_comments_received"),
        sum("view_count").alias("total_recipe_views"),
        max("view_count").alias("most_viewed_recipe_views")
    )
)

creator_metrics.write \
    .format("delta") \
    .mode("overwrite") \
    .save(os.path.join(GOLD, "creator_metrics"))

print("Creator metrics created.")

# --------------------------------------------------
# Recipe Metrics
# --------------------------------------------------

recipe_metrics = (
    recipes.alias("r")
    .join(
        ratings.groupBy("Recipes_idRecipes")
        .agg(
            avg("num_stars").alias("average_rating"),
            count("*").alias("rating_count")
        )
        .alias("ra"),
        col("r.recipe_id") == col("ra.Recipes_idRecipes"),
        "left"
    )
    .join(
        comments.groupBy("Recipes_idRecipes")
        .agg(
            count("*").alias("comment_count")
        )
        .alias("co"),
        col("r.recipe_id") == col("co.Recipes_idRecipes"),
        "left"
    )
    .join(
    recipe_views.alias("rv"),
    col("r.recipe_id").cast("string") == col("rv.entity_id"),
    "left"
    )
    .select(
    col("recipe_id"),
    col("title"),
    col("creator"),
    col("date_posted"),
    col("average_rating"),
    col("rating_count"),
    col("comment_count"),
    col("view_count")
    )
    .fillna({
    "view_count": 0,
    "rating_count": 0,
    "comment_count": 0
    })
)

recipe_metrics.write \
    .format("delta") \
    .mode("overwrite") \
    .save(os.path.join(GOLD, "recipe_metrics"))

print("Recipe metrics created.")

## Most viewed recipe
creator_top_recipe = (
    recipes.alias("r")
    .join(
        recipe_views.alias("rv"),
        col("r.recipe_id").cast("string") == col("rv.entity_id"),
        "left"
    )
    .fillna({"view_count": 0})
)

window = Window.partitionBy("creator").orderBy(col("view_count").desc())

creator_top_recipe = (
    creator_top_recipe
    .withColumn("rank", row_number().over(window))
    .filter(col("rank") == 1)
    .select(
        col("creator"),
        col("title").alias("most_viewed_recipe"),
        col("view_count")
    )
)

creator_top_recipe.write \
    .format("delta") \
    .mode("overwrite") \
    .save(os.path.join(GOLD, "creator_top_recipe"))

print("Creator top recipe created.")

# --------------------------------------------------
# Rating Summary
# --------------------------------------------------

rating_summary = (
    ratings.groupBy("num_stars")
    .count()
    .orderBy("num_stars")
)

rating_summary.write \
    .format("delta") \
    .mode("overwrite") \
    .save(os.path.join(GOLD, "rating_summary"))

print("Rating summary created.")

# --------------------------------------------------
# Engagement Metrics
# --------------------------------------------------

engagement_metrics = (
    activity.groupBy("event_type")
    .agg(
        count("*").alias("total_events"),
        max("created_at").alias("last_event")
    )
)

engagement_metrics.write \
    .format("delta") \
    .mode("overwrite") \
    .save(os.path.join(GOLD, "engagement_metrics"))

print("Engagement metrics created.")

print("\nGold layer successfully created.")