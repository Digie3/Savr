# Savr – Recipe Sharing Social Platform

## Motivation

Savr is a full-stack social media platform designed for recipe sharing, food discovery, and community engagement.

Recipes are often scattered across personal blogs, websites, and social media platforms, making it difficult for users to discover new content and stay connected with their favorite creators. Savr addresses this problem by providing a centralized platform where users can share recipes, explore cooking ideas, and interact with a community of food enthusiasts.

Savr prioritizes:

* Community-driven content
* Easy recipe discovery
* Creator engagement
* User-friendly design
* Maintainable and scalable architecture

The goal of Savr is to create an organized and interactive environment where users can discover recipes, connect with creators, and share their passion for cooking.

---

## Project Overview

Savr is being developed as a full-stack web application following a **service-based architecture** with a single web interface.

### Technology Stack

**Frontend**

* React
* JavaScript
* HTML
* CSS

**Backend**

* Java 17
* Node.js
* Express

**Database**

* SQLite

**Data Lakehouse**
* Python
* Apache Spark 4.1.0
* PySpark 4.1.0
* Delta Lake 4.2.0

**Platform**
* Docker

### Core Features

Users will be able to:

* Create and manage accounts
* Log in securely
* Upload recipes with ingredients, instructions, and images
* Edit and delete their recipes
* Browse recipes from the community
* Comment on recipes
* Rate recipes
* Save recipes for future reference
* Follow creators
* Receive updates from followed creators
* Search for recipes
* Sort recipes by:

  * Highest Rated
  * Most Viewed
  * Trending
  * Newest Uploads

The system is designed to separate responsibilities across backend services, improving maintainability and allowing future expansion.

---

## System Architecture

Savr follows a service-based architecture consisting of:

### Presentation Layer

* React frontend
* Provides the user interface and user interactions

### API Gateway

* Central entry point for frontend requests
* Routes requests to the appropriate backend services

### Backend Services

#### Authentication Service

Handles:

* User registration
* Login and logout
* Session management
* Authentication validation

#### Recipe Service

Handles:

* Recipe creation
* Recipe editing
* Recipe deletion
* Recipe viewing
* Ingredient management

#### Comment and Rating Service

Handles:

* Comment creation and management
* Recipe ratings
* Rating calculations

#### Follow Service

Handles:

* Following creators
* Unfollowing creators
* Follower and following lists

#### Saved Recipe Service

Handles:

* Saving recipes
* Removing saved recipes
* Managing personal recipe collections

#### Statistics and Sorting Service

Handles:

* Recipe view tracking
* Trending calculations
* Sorting functionality

#### Image Service

Handles:

* Retrieval of recipe and ingredient-related images
* Ingredient image search via the Google Custom Search API, with a built-in local fallback so it works with no API keys configured

See [Documentation/image-service.md](Documentation/image-service.md) for setup, environment variables, endpoint reference, and troubleshooting.

### Data Layer

* Data Lakehouse architecture
* SQLite database
* Stores users, recipes, comments, ratings, followers, and saved recipes

---

## Installation

### Prerequisites

#### Windows
1. Install Install WSL 2
* Open PowerShell as Administrator and run: ```text wsl --install ```

* Restart your computer after installation (if needed).

* Verify WSL 2 (ignore WSL 1 message): ```text wsl --status ```
  

2. Install Docker Desktop
* Download and install Docker Desktop.

* Restart your computer after installation (if needed).

* Verify Docker Installation: ```text docker --version ```

* Note: The other softwares needed are installed using Docker build (more info below).

  
3. Install Git on Windows
---
#### MacOS
1. Install Docker Desktop

* Download and install Docker Desktop.

* Restart your computer after installation (if needed).

* Verify Docker Installation: ```text docker --version ```

* Note: The other softwares needed are installed using Docker build (more info below).

2. Install Git on Mac

---
## Running the Application

### 1. Clone the Repository

### 1.1 Optional: Manual Update for Data Lakehouse

#### Using Docker (recommended)

```text
docker compose exec backend bash
cd /lakehouse/etl
python3 run_pipeline.py
```

#### Not using Docker (not recommended)

```text
cd .../backend/lakehouse/etl
python3 run_pipeline.py
```

#### Note: Lakehouse is setup to automatically begin updating every min (processing time is longer, expect 5 mins or more)

### 2. Environment Configuration

The backend reads its settings from a `.env` file. Copy the provided template:

```text
cd .../backend
cp .env.example .env
```

**No configuration is required to run the app** — the defaults work out of the box. Google image-search credentials are optional:

* Leave `GOOGLE_SEARCH_API_KEY` and `GOOGLE_SEARCH_ENGINE_ID` **blank** to use the built-in local ingredient image suggestions — image search is fully functional this way.
* Fill in **both** only if you want **live Google web-image search**.

See [Documentation/image-service.md](Documentation/image-service.md) for details.

### 3. Running Docker (recommended)
* #### Build & Run (if you haven't built already): ```text docker compose up --build ```
* Note: Building Docker is mandatory, it installs all the software needed (outside of the prerequisite software installation).
  
* Close Docker Containers: ```text docker compose down ```
* Run (if you have built already): ```text docker compose up ```

### 3. Alternative: Not Running Docker (not recommended)

 Backend (terminal 1):
 If this is your first time running, use 'npm install' after navigating to both the backend and frontend folders.
 ```text
 cd .../backend
 node index.js
 ```

 Frontend (terminal 2):
```text
cd .../frontend
npm run dev
```
Your frontend terminal should give you a localhost address, copy and paste it into your browser.


---

### Database

Savr uses SQLite for persistent storage.

The SQLite database file will be created automatically when the backend is launched for the first time.

No separate database installation is required.

---

### Data Lakehouse

Savr uses Apache Spark + Pyspark to process and transform the data, while Delta Lake provides the ACID transactions.

Delete lakehouse data: Delete bronze, silver and gold folders within Database/lakehouse/data

---

## Development Workflow

### Branching Strategy

1. Clone the repository.
2. Create a new feature branch:

```text
feature/short-description
```

Example:

```text
feature/recipe-upload
```

3. Develop only within your feature branch.
4. Commit changes regularly.
5. Push changes to GitHub.
6. Open a Pull Request.
7. Request review from at least one team member.
8. Merge only after approval.

---

## Project Management

The team uses:

* GitHub for version control
* GitHub Desktop for task tracking
* Pull Requests for code review
* Discord for communication and coordination
* Docker for software compatibility 

All development work should be associated with a project requirement, user story, or assigned task.

---

## Team Members

* Manjot Kaur
* Gurnoor Kahlon
* Nathan Kwok
* Andriy Lytvyn
* Larissa Singh
* Rishab Yadav

For educational use only.
