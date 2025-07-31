
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function generateRandomPassword(length = 8): string {
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let password = "";
  for (let i = 0, n = charset.length; i < length; ++i) {
    password += charset.charAt(Math.floor(Math.random() * n));
  }
  return password;
}

export function generateRandomString(length = 8): string {
  const charset = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0, n = charset.length; i < length; ++i) {
    result += charset.charAt(Math.floor(Math.random() * n));
  }
  return result;
}

// Function to generate random Tunisian phone numbers
export function generatePhoneNumber(): string {
  const prefixes = ["20", "21", "22", "23", "24", "25", "26", "27", "28", "29", "50", "55", "70", "71", "72", "73", "74", "75", "76", "77", "78", "79", "90", "91", "92", "93", "94", "95", "96", "97", "98", "99"];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const number = Math.floor(100000 + Math.random() * 900000); // 6 digits
  return `+216 ${prefix} ${String(number).slice(0,3)} ${String(number).slice(3)}`; // Added spaces for better readability
}

// Function to generate random date of birth (between 1960 and 2005)
export function generateDateOfBirth(): string {
  const start = new Date(1960, 0, 1);
  const end = new Date(2005, 11, 31);
  const date = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  return date.toISOString().split("T")[0]; // Format as YYYY-MM-DD
}
