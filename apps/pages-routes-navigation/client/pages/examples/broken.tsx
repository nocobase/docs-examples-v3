// Deliberate opt-in route for trying the application's real error boundary.
export default function BrokenPage(): never {
  throw new Error('Intentional routing example failure');
}
