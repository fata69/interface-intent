package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// BearerAuth is an optional middleware that validates Bearer tokens.
// If authAPIURL is empty, all requests are allowed through (no auth).
// If authAPIURL is set, the middleware forwards the Bearer token to that URL
// to validate the session (e.g., GET /api/auth/me on the main API).
func BearerAuth(authAPIURL string) gin.HandlerFunc {
	return func(c *gin.Context) {
		// If no auth URL configured, skip validation
		if authAPIURL == "" {
			c.Next()
			return
		}

		authHeader := c.GetHeader("Authorization")
		if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error_code": 401,
				"message":    "Authorization header dengan Bearer token diperlukan.",
			})
			return
		}

		// Validate token by calling the main API's auth/me endpoint
		req, err := http.NewRequestWithContext(c.Request.Context(), http.MethodGet, authAPIURL, nil)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
				"error_code": 500,
				"message":    "Gagal memvalidasi token.",
			})
			return
		}
		req.Header.Set("Authorization", authHeader)

		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
				"error_code": 500,
				"message":    "Gagal menghubungi server autentikasi.",
			})
			return
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error_code": 401,
				"message":    "Token tidak valid atau sudah expired.",
			})
			return
		}

		c.Next()
	}
}
