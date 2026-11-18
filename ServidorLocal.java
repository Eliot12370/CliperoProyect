import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.file.Files;
import java.nio.file.Path;

public class ServidorLocal {
    public static void main(String[] args) throws IOException {
        int puerto = 8080;
        HttpServer server = HttpServer.create(new InetSocketAddress(puerto), 0);

        server.createContext("/", exchange -> {
            String ruta = exchange.getRequestURI().getPath();
            if (ruta.equals("/")) {
                ruta = "/index.html";
            }

            Path archivo = Path.of("." + ruta);
            if (Files.exists(archivo) && !Files.isDirectory(archivo)) {
                String tipo = ruta.endsWith(".css") ? "text/css"
                        : ruta.endsWith(".js")  ? "application/javascript"
                          : "text/html; charset=UTF-8";

                byte[] bytes = Files.readAllBytes(archivo);
                exchange.getResponseHeaders().set("Content-Type", tipo);
                exchange.sendResponseHeaders(200, bytes.length);
                exchange.getResponseBody().write(bytes);
            } else {
                exchange.sendResponseHeaders(404, -1);
            }
            exchange.close();
        });

        server.start();
        System.out.println("Servidor corriendo en: http://localhost:" + puerto);
    }
}