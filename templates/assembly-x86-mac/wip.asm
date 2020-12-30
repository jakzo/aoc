; Syscall Macros
; https://github.com/opensource-apple/xnu/blob/master/bsd/kern/syscalls.master
SYSCALL_CLASS_UNIX equ 0x02000000
%macro oscall 2
mov rax, SYSCALL_CLASS_UNIX | %1
mov rdi, %2
syscall
%endmacro
%macro oscall 4
mov rax, SYSCALL_CLASS_UNIX | %1
mov rdi, %2
mov rsi, %3
mov rdx, %4
syscall
%endmacro
%macro oscall 7
mov rax, SYSCALL_CLASS_UNIX | %1
mov rdi, %2
mov rsi, %3
mov rdx, %4
mov r10, %5
mov r8, %6
mov r9, %7
syscall
%endmacro
%define exit(rval) oscall 1, rval
%define write(fd, cbuf, nbyte) oscall 4, fd, cbuf, nbyte
PROT_READ equ 0x01
PROT_WRITE equ 0x02
MAP_ANON equ 0x1000
%define mmap(addr, len, prot, flags, fd, pos) oscall 197, addr, len, prot, flags, fd, pos

global _main

section .text

%macro int_to_str 0
mov rcx, 10
%%push_digit:
  xor rdx, rdx
  div rcx
  add rdx, '0'
  push rdx
  cmp rax, 0
  jnz %%push_digit
%endmacro

%macro print_int 1
push rax
push rbx
push rcx
push rdx
mov rax, %1
mov rbx, rsp
push 10
int_to_str
sub rbx, rsp
write(1, rsp, rbx)
add rsp, rbx
pop rdx
pop rcx
pop rbx
pop rax
%endmacro

%macro solution 2
move rax, 123
%endmacro

%macro part 2
solution input, %2
mov rbx, rsp
; TODO: Print properly
push 10
int_to_str
push ": "
push '0' + %1
push " "
push "Part"
sub rbx, rsp
write(1, rsp, rbx)
add rsp, rbx
%endmacro

_main:
  part 1, 2020
  part 2, 30000000
  exit(0)

section .data

section .rodata

input:
  ; TODO: Read from file
  dq 1, 2, 3
