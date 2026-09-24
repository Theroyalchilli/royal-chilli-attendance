import FoodSafetyTasks from "@/components/FoodSafetyTasks";

// Same component as /me/food-safety — it's already fully role-aware
// (manager gets full log + sign-off, admin gets view-only) via the API's
// own permission check, not the URL. This route exists purely so Team-side
// navigation (the dashboard card, the sidebar) never sends a manager/admin
// into the /me/* URL tree, which reads as "the employee section" even
// though the page itself was always safe to land on.
export default function Page() {
  return <FoodSafetyTasks />;
}
