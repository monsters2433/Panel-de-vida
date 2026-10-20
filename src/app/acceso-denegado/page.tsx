import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function AccesoDenegadoPage() {
  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">Acceso denegado</CardTitle>
          <CardDescription>
            Esta aplicación es privada. La cuenta con la que entraste no tiene
            permiso para usarla.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action="/auth/signout" method="post">
            <Button type="submit" variant="outline" className="w-full">
              Volver al inicio de sesión
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
