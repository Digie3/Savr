-- SQLite Script
-- Mon, Jun 22, 2026
-- Model: recipe_social_media.sql    Version: 2.0

PRAGMA foreign_keys = ON;

-- -----------------------------------------------------
-- Table `Users`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS Users (
    idUsers INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    profile_image BLOB,
    account_creation DATETIME NOT NULL,
    country TEXT,
    gender TEXT,
    birthday DATE,
    age INTEGER CHECK (age >= 16)
);

-- -----------------------------------------------------
-- Table `Recipes`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS Recipes (
    idRecipes INTEGER PRIMARY KEY AUTOINCREMENT,
    Users_idUsers INTEGER NOT NULL,
    title TEXT NOT NULL CHECK(length(description) <= 100),
    description TEXT CHECK(length(description) <= 1000),
    instructions TEXT CHECK(length(description) <= 1000),
    prep_time INTEGER NOT NULL CHECK (prep_time >= 0),
    cooking_time INTEGER NOT NULL CHECK (cooking_time >= 0),
    num_servings INTEGER NOT NULL CHECK (num_servings > 0),
    date_posted DATETIME NOT NULL,
    FOREIGN KEY (Users_idUsers)
        REFERENCES Users(idUsers)
);

-- -----------------------------------------------------
-- Table `Comments`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS Comments (
    idComments INTEGER PRIMARY KEY AUTOINCREMENT,
    Recipes_idRecipes INTEGER NOT NULL,
    Users_idUsers INTEGER NOT NULL,
    description TEXT NOT NULL,
    date_posted DATETIME NOT NULL,
    FOREIGN KEY (Recipes_idRecipes)
        REFERENCES Recipes(idRecipes),
    FOREIGN KEY (Users_idUsers)
        REFERENCES Users(idUsers)
);

-- -----------------------------------------------------
-- Table `Ratings`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS Ratings (
    idRatings INTEGER PRIMARY KEY AUTOINCREMENT,
    Recipes_idRecipes INTEGER NOT NULL,
    Users_idUsers INTEGER NOT NULL,
    num_stars INTEGER NOT NULL CHECK (num_stars BETWEEN 1 AND 5),
    date_posted DATETIME NOT NULL,
    FOREIGN KEY (Recipes_idRecipes)
        REFERENCES Recipes(idRecipes),
    FOREIGN KEY (Users_idUsers)
        REFERENCES Users(idUsers)
);

-- -----------------------------------------------------
-- Table `Ingredients`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS Ingredients (
    idIngredients INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT
);

-- -----------------------------------------------------
-- Table `Followers`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS Followers (
    idFollower INTEGER NOT NULL,
    idFollowed INTEGER NOT NULL,
    followed_date DATETIME NOT NULL,
    PRIMARY KEY (idFollower, idFollowed),
    FOREIGN KEY (idFollower)
        REFERENCES Users(idUsers),
    FOREIGN KEY (idFollowed)
        REFERENCES Users(idUsers)
);

-- -----------------------------------------------------
-- Table `SavedRecipes`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS SavedRecipes (
    Users_idUsers INTEGER NOT NULL,
    Recipes_idRecipes INTEGER NOT NULL,
    bookmarked_date DATETIME NOT NULL,
    PRIMARY KEY (Users_idUsers, Recipes_idRecipes),
    FOREIGN KEY (Users_idUsers)
        REFERENCES Users(idUsers),
    FOREIGN KEY (Recipes_idRecipes)
        REFERENCES Recipes(idRecipes)
);

-- -----------------------------------------------------
-- Table `Recipes_has_Ingredients`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS Recipes_has_Ingredients (
    Recipes_idRecipes INTEGER NOT NULL,
    Ingredients_idIngredients INTEGER NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    weight TEXT NOT NULL,
    other_desc TEXT,
    PRIMARY KEY (
        Recipes_idRecipes,
        Ingredients_idIngredients
    ),
    FOREIGN KEY (Recipes_idRecipes)
        REFERENCES Recipes(idRecipes),
    FOREIGN KEY (Ingredients_idIngredients)
        REFERENCES Ingredients(idIngredients)
);

-- -----------------------------------------------------
-- Table `Media`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS Media (
    idMedia INTEGER PRIMARY KEY AUTOINCREMENT,
    media_url TEXT NOT NULL,
    display_order INTEGER DEFAULT 0,
    media_type TEXT NOT NULL
);

-- -----------------------------------------------------
-- Table `RecipeMedia`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS RecipeMedia (
    idRecipeMedia INTEGER PRIMARY KEY AUTOINCREMENT,
    Media_idMedia INTEGER NOT NULL,
    Recipes_idRecipes INTEGER NOT NULL,
    FOREIGN KEY (Media_idMedia)
        REFERENCES Media(idMedia),
    FOREIGN KEY (Recipes_idRecipes)
        REFERENCES Recipes(idRecipes)
);

-- -----------------------------------------------------
-- Table `IngredientMedia`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS IngredientMedia (
    idIngredientMedia INTEGER PRIMARY KEY AUTOINCREMENT,
    Media_idMedia INTEGER NOT NULL,
    Ingredients_idIngredients INTEGER NOT NULL,
    FOREIGN KEY (Media_idMedia)
        REFERENCES Media(idMedia),
    FOREIGN KEY (Ingredients_idIngredients)
        REFERENCES Ingredients(idIngredients)
);

-- -----------------------------------------------------
-- Table `ActivityEvents`
-- Simplified lakehouse/event log for analytics.
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS ActivityEvents (
    idActivityEvents INTEGER PRIMARY KEY AUTOINCREMENT,
    Users_idUsers INTEGER,
    username TEXT,
    event_type TEXT NOT NULL,
    entity_type TEXT,
    entity_id TEXT,
    event_value REAL,
    metadata_json TEXT,
    source TEXT NOT NULL DEFAULT 'web',
    created_at DATETIME NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (Users_idUsers)
        REFERENCES Users(idUsers)
);

-- -----------------------------------------------------
-- Indexes
-- -----------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_recipes_user
ON Recipes(Users_idUsers);

CREATE INDEX IF NOT EXISTS idx_comments_recipe
ON Comments(Recipes_idRecipes);

CREATE INDEX IF NOT EXISTS idx_comments_user
ON Comments(Users_idUsers);

CREATE INDEX IF NOT EXISTS idx_ratings_recipe
ON Ratings(Recipes_idRecipes);

CREATE INDEX IF NOT EXISTS idx_ratings_user
ON Ratings(Users_idUsers);

CREATE INDEX IF NOT EXISTS idx_savedrecipes_recipe
ON SavedRecipes(Recipes_idRecipes);

CREATE INDEX IF NOT EXISTS idx_recipemedia_recipe
ON RecipeMedia(Recipes_idRecipes);

CREATE INDEX IF NOT EXISTS idx_recipemedia_media
ON RecipeMedia(Media_idMedia);

CREATE INDEX IF NOT EXISTS idx_ingredientmedia_ingredient
ON IngredientMedia(Ingredients_idIngredients);

CREATE INDEX IF NOT EXISTS idx_ingredientmedia_media
ON IngredientMedia(Media_idMedia);

CREATE INDEX IF NOT EXISTS idx_followers_follower
ON Followers(idFollower);

CREATE INDEX IF NOT EXISTS idx_followers_followed
ON Followers(idFollowed);

CREATE INDEX IF NOT EXISTS idx_activity_events_type
ON ActivityEvents(event_type);

CREATE INDEX IF NOT EXISTS idx_activity_events_created
ON ActivityEvents(created_at);

CREATE INDEX IF NOT EXISTS idx_activity_events_entity
ON ActivityEvents(entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_activity_events_user
ON ActivityEvents(Users_idUsers);
