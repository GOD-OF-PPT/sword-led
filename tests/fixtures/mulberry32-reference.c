/* Algorithm: Tommy Ettinger, CC0. See THIRD_PARTY_NOTICES.md. */
#include <stdint.h>
#include <stdio.h>
uint32_t x;
uint32_t next(void) {
  uint32_t z = (x += 0x6D2B79F5UL);
  z = (z ^ (z >> 15)) * (z | 1UL);
  z ^= z + (z ^ (z >> 7)) * (z | 61UL);
  return z ^ (z >> 14);
}
int main(void) {
  uint32_t seeds[] = {0, 1, 0xffffffffu};
  for (int s = 0; s < 3; s++) { x = seeds[s]; printf("%u", x); for(int n = 0; n < 5; n++) printf(",%u", next()); puts(""); }
}
