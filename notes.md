# User SignIn Flow (technical)

1. Initial Request (No balancer cookie set)
2. Gets redirected to `/balancer`
3. User registeres with a user / teamname
   1. A JuiceShop Instance gets started in the background
   2. The user gets a 8 digit alphanumeric secret displayed
   3. The user gets a cookie set consisting of `${teamname}`. The cookie gets signed using express signed cookies, to ensure the cookie cant get tampered with by the users.
4. The User polls for the Instance to get ready
5. Once ready the user is redirected back to `/`
