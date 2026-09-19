import { Button, TextField } from "@acme/ui";
export function Form() {
  return (
    <form>
      <TextField name="email" label="Email" />
      <Button type="submit">Save</Button>
    </form>
  );
}
