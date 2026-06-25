import { BrowserRouter, Routes, Route } from "react-router-dom";

import Navbar from "./components/Navbar";

import Landing from "./pages/Landing";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Profile from "./pages/Profile";
import SavedRecipes from "./pages/SavedRecipes";
import CreateRecipe from "./pages/CreateRecipe";
import RecipeDetails from "./pages/RecipeDetails";
import Analytics from "./pages/Analytics";

function App() {
  return (
    <BrowserRouter>
      <Navbar />

      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/home" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/saved" element={<SavedRecipes />} />
        <Route path="/create" element={<CreateRecipe />} />
        <Route path="/recipe" element={<RecipeDetails />} />
        <Route path="/analytics" element={<Analytics />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
