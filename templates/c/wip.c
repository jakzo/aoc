#include <stdio.h>
#include <unistd.h>
#include <fcntl.h>
#include <sys/mman.h>
#include <stdlib.h>

long vanEck(int seedLen, long *seed, int nth)
{
  int i = 0;
  long *m = calloc(nth, sizeof(long));
  for (int j = 0; j < seedLen; j++)
    m[seed[j]] = ++i;
  long next = 0;
  while (++i < nth)
  {
    long n = next;
    next = i - (m[next] == 0 ? i : m[next]);
    m[n] = i;
  }
  return next;
}

int main()
{
  // TODO: Read from file
  long input[] = {20L, 0L, 1L, 11L, 6L, 3L};

  long a = 123;
  long b = 456;

  printf("Part 1: %ld, Part 2: %ld\n", a, b);
}
