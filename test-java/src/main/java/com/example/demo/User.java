package com.example.demo;

import java.time.LocalDateTime;
import java.util.Objects;

/**
 * User entity class
 * 
 * Represents a user in the system with basic information.
 */
public class User {
    
    private final String name;
    private final String email;
    private final LocalDateTime createdAt;
    
    /**
     * Creates a new User instance
     * 
     * @param name the user's name
     * @param email the user's email address
     */
    public User(String name, String email) {
        this.name = name;
        this.email = email;
        this.createdAt = LocalDateTime.now();
    }
    
    /**
     * Gets the user's name
     * 
     * @return the user's name
     */
    public String getName() {
        return name;
    }
    
    /**
     * Gets the user's email
     * 
     * @return the user's email address
     */
    public String getEmail() {
        return email;
    }
    
    /**
     * Gets the creation timestamp
     * 
     * @return when the user was created
     */
    public LocalDateTime getCreatedAt() {
        return createdAt;
    }
    
    @Override
    public boolean equals(Object obj) {
        if (this == obj) return true;
        if (obj == null || getClass() != obj.getClass()) return false;
        User user = (User) obj;
        return Objects.equals(name, user.name) && 
               Objects.equals(email, user.email);
    }
    
    @Override
    public int hashCode() {
        return Objects.hash(name, email);
    }
    
    @Override
    public String toString() {
        return "User{" +
                "name='" + name + '\'' +
                ", email='" + email + '\'' +
                ", createdAt=" + createdAt +
                '}';
    }
}
