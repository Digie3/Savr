import sqlite3
import os
from spark_session import spark
from pyspark.sql.types import (
    StructType,
    StructField,
    IntegerType,
    DoubleType,
    BinaryType,
    StringType,
)

# Root Folder
BASE = os.path.dirname(__file__)

# Database
DATABASE = os.path.join(BASE, "..", "..", "..", "..", "Database", "relational_database", "v.3.0", "recipe_social_media.db")

# Bronze
BRONZE = os.path.join(BASE, "..", "..", "..", "..", "Codebase", "backend", "lakehouse", "data", "bronze")
os.makedirs(BRONZE, exist_ok = True)

TABLES = {
    "Users": "users",
    "Recipes": "recipes",
    "RecipeSteps": "recipe_steps",
    "Comments": "comments",
    "Ratings": "ratings",
    "Ingredients": "ingredients",
    "Followers": "followers",
    "SavedRecipes": "saved_recipes",
    "Recipes_has_Ingredients": "recipe_ingredients",
    "Media": "media",
    "RecipeMedia": "recipe_media",
    "IngredientMedia": "ingredient_media",
    "RecipeStepMedia": "recipe_step_media",
    "ActivityEvents": "activity_events"
}

# Connect to Database
connection = sqlite3.connect(DATABASE)

try:
    for sqlite_table, delta_folder in TABLES.items():

        print(f"\nIngesting {sqlite_table}...")

        try:
            cursor = connection.execute(f"SELECT * FROM {sqlite_table}")
            columns = [col[0] for col in cursor.description]
            rows = cursor.fetchall()

            print(f"Fetched {len(rows)} rows")

            if len(rows) == 0:
                print("Table is empty. Skipping.")
                continue

            pragma = connection.execute(f"PRAGMA table_info({sqlite_table})")
            fields = []

            for _, name, sqltype, *_ in pragma.fetchall():

                sqltype = sqltype.upper()

                if "INT" in sqltype:
                    dtype = IntegerType()

                elif "REAL" in sqltype or "FLOAT" in sqltype or "DOUBLE" in sqltype:
                    dtype = DoubleType()

                elif "BLOB" in sqltype:
                    dtype = BinaryType()

                else:
                    # TEXT, DATE, DATETIME, etc.
                    dtype = StringType()

                fields.append(
                    StructField(name, dtype, True)
                )

            schema = StructType(fields)

            df = spark.createDataFrame(rows, schema=schema)

            output = os.path.join(
                BRONZE,
                delta_folder,
            )

            df.write \
                .format("delta") \
                .mode("overwrite") \
                .save(output)

            print(f"✓ Saved to {output}")

        except Exception as e:

            print(f"✗ Failed {sqlite_table}")
            print(e)

finally:
    connection.close()

print("\nBronze layer successfully created.")
