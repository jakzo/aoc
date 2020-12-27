import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Paths;

class Main {
  public static void main(String args[]) throws IOException {
    String input = new String(Files.readAllBytes(Paths.get("input.txt"))).strip();

    long result = 0;
    System.out.println("Result: " + result);
  }
}
