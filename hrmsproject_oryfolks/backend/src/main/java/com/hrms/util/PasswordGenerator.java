package com.hrms.util;

import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public class PasswordGenerator {
    private static final String UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    private static final String LOWER = "abcdefghijklmnopqrstuvwxyz";
    private static final String DIGITS = "0123456789";
    private static final String SPECIAL = "!@#$%^&*()-_=+[]{}|;:,.<>?";
    private static final String ALL = UPPER + LOWER + DIGITS + SPECIAL;
    private static final SecureRandom random = new SecureRandom();

    public static String generateSecurePassword() {
        List<Character> charList = new ArrayList<>();
        // Ensure at least one character from each required set
        charList.add(UPPER.charAt(random.nextInt(UPPER.length())));
        charList.add(LOWER.charAt(random.nextInt(LOWER.length())));
        charList.add(DIGITS.charAt(random.nextInt(DIGITS.length())));
        charList.add(SPECIAL.charAt(random.nextInt(SPECIAL.length())));

        // Fill remaining characters up to 12
        for (int i = 4; i < 12; i++) {
            charList.add(ALL.charAt(random.nextInt(ALL.length())));
        }

        // Shuffle the characters for randomness
        Collections.shuffle(charList, random);

        StringBuilder sb = new StringBuilder();
        for (char c : charList) {
            sb.append(c);
        }
        return sb.toString();
    }
}
