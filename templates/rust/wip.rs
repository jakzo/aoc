use std::fs::File;
use std::io;
use std::io::prelude::*;
use std::path::Path;

fn main() -> io::Result<()> {
  let mut file = File::open(Path::new("input.txt"))?;
  let mut input = String::new();
  file.read_to_string(&mut input)?;

  let result = 0;
  println!("Result: {}", result);
  Ok(())
}
