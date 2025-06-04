// server.js
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const sql = require('mssql');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

const dbConfig = {
  user: 'sa',
  password: 'Nano2005@',
  server: 'DESKTOP-DCE44QG',
  instanceName: 'SQLEXPRESS',
  database: 'dbms_project_2025',
  options: { trustServerCertificate: true, enableArithAbort: true },
  port: 1433
};
async function getPool() { 
  return sql.connect(dbConfig);
}

// ------------- USER SIGNUP -------------
app.post('/api/users/signup', async (req, res) => {
  const { username, password, email, address } = req.body;
  if (!username || !password || !email || !address) {
    return res.status(400).send('All fields are required');
  }
  try {
    const pool = await getPool();
    await pool.request()
      .input('u', sql.NVarChar, username)
      .input('p', sql.NVarChar, password)
      .input('e', sql.NVarChar, email)
      .input('a', sql.NVarChar, address)
      .query(`
        INSERT INTO dbo.Users (Username, Password, Email, Address)
        VALUES (@u, @p, @e, @a)
      `);
    res.status(201).send('User created');
  } catch (err) {
    console.error('Signup error:', err.stack);
    if (err.number === 2627) {
      return res.status(409).send('Username or email already exists');
    }
    res.status(500).send('Signup failed');
  }
});

// ------------- USER SIGNIN -------------
app.post('/api/users/signin', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).send('Username and password are required');
  }
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('u', sql.NVarChar, username)
      .query(`
        SELECT UserID, Password
        FROM dbo.Users
        WHERE Username = @u
      `);
    if (!result.recordset.length) {
      return res.status(404).send('No such user');
    }

    const { UserID, Password: storedPassword } = result.recordset[0];
    if (password !== storedPassword) {
      return res.status(401).send('Invalid credentials');
    }

    res.json({ userId: UserID });
  } catch (err) {
    console.error('Signin error:', err.stack);
    res.status(500).send('Signin failed');
  }
});

// ------------- PRODUCTS -------------
app.get('/api/products', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .query(`
        SELECT p.ProductID, p.Name, c.Name AS Category, p.Price, p.ImagePath
        FROM dbo.Products p
        JOIN dbo.Categories c ON p.CategoryID = c.CategoryID
      `);
    res.json(result.recordset);
  } catch (err) {
    console.error('Fetch products error:', err.stack);
    res.status(500).send('Error fetching products');
  }
});

// ------------- CART -------------
app.get('/api/cart/:userId', async (req, res) => {
  const userId = parseInt(req.params.userId, 10);
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('uid', sql.Int, userId)
      .query(`
        SELECT ProductID, ProductName, Quantity
        FROM dbo.CartItems
        WHERE UserID = @uid
      `);
    res.json(result.recordset);
  } catch (err) {
    console.error('Fetch cart error:', err.stack);
    res.status(500).send('Error fetching cart');
  }
});

app.post('/api/cart', async (req, res) => {
  const { userId, productId, productName } = req.body;
  try {
    const pool = await getPool();
    await pool.request()
      .input('u', sql.Int, userId)
      .input('p', sql.Int, productId)
      .input('n', sql.NVarChar, productName)
      .query(`
        MERGE dbo.CartItems AS target
        USING (VALUES(@u,@p,@n,1)) AS src(UserID,ProductID,ProductName,Qty)
          ON target.UserID=src.UserID AND target.ProductID=src.ProductID
        WHEN MATCHED THEN
          UPDATE SET Quantity = target.Quantity + 1
        WHEN NOT MATCHED THEN
          INSERT (UserID,ProductID,ProductName,Quantity)
          VALUES (src.UserID,src.ProductID,src.ProductName,src.Qty);
      `);
    res.send('Added to cart');
  } catch (err) {
    console.error('Add cart error:', err.stack);
    res.status(500).send('Error adding to cart');
  }
});

app.delete('/api/cart/:userId/:productId', async (req, res) => {
  const userId    = parseInt(req.params.userId, 10);
  const productId = parseInt(req.params.productId, 10);
  try {
    const pool = await getPool();
    await pool.request()
      .input('u', sql.Int, userId)
      .input('p', sql.Int, productId)
      .query(`
        DELETE FROM dbo.CartItems
        WHERE UserID=@u AND ProductID=@p
      `);
    res.send('Removed from cart');
  } catch (err) {
    console.error('Remove cart error:', err.stack);
    res.status(500).send('Error removing from cart');
  }
});

// ------------- WISHLIST -------------
app.post('/api/wishlist', async (req, res) => {
  const { userId, productId } = req.body;
  try {
    const pool = await getPool();
    await pool.request()
      .input('u', sql.Int, userId)
      .input('p', sql.Int, productId)
      .query(`
        INSERT INTO dbo.WishlistItems (UserID,ProductID)
        VALUES (@u,@p)
      `);
    res.sendStatus(201);
  } catch (err) {
    console.error('Wishlist add error:', err.stack);
    res.status(500).send('Error adding to wishlist');
  }
});

app.delete('/api/wishlist/:userId/:productId', async (req, res) => {
  const userId    = parseInt(req.params.userId, 10);
  const productId = parseInt(req.params.productId, 10);
  try {
    const pool = await getPool();
    await pool.request()
      .input('u', sql.Int, userId)
      .input('p', sql.Int, productId)
      .query(`
        DELETE FROM dbo.WishlistItems
        WHERE UserID=@u AND ProductID=@p
      `);
    res.sendStatus(200);
  } catch (err) {
    console.error('Wishlist delete error:', err.stack);
    res.status(500).send('Error removing from wishlist');
  }
});

app.get('/api/wishlist/:userId', async (req, res) => {
  const userId = parseInt(req.params.userId, 10);
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('u', sql.Int, userId)
      .query(`
        SELECT p.ProductID,p.Name,p.Price,p.ImagePath,c.Name AS Category
        FROM dbo.WishlistItems w
        JOIN dbo.Products p ON w.ProductID=p.ProductID
        JOIN dbo.Categories c ON p.CategoryID=c.CategoryID
        WHERE w.UserID=@u
      `);
    res.json(result.recordset);
  } catch (err) {
    console.error('Fetch wishlist error:', err.stack);
    res.status(500).send('Error fetching wishlist');
  }
});

// ------------- REVIEWS -------------
app.post('/api/reviews', async (req, res) => {
  const { userId, productId, rating, comment } = req.body;
  if (!userId || !productId || !rating || !comment) {
    return res.status(400).send('All review fields are required');
  }
  try {
    const pool = await getPool();
    await pool.request()
      .input('u', sql.Int, userId)
      .input('p', sql.Int, productId)
      .input('r', sql.Int, rating)
      .input('c', sql.NVarChar, comment)
      .query(`
        INSERT INTO dbo.Reviews (UserID,ProductID,Rating,Comment)
        VALUES (@u,@p,@r,@c)
      `);
    res.sendStatus(201);
  } catch (err) {
    console.error('Review error:', err.stack);
    res.status(500).send('Error submitting review');
  }
});

// ------------- COUPONS -------------
app.post('/api/coupons/apply', async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).send('Coupon code required');
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('c', sql.NVarChar, code)
      .query(`
        SELECT CouponID,Code,DiscountPercent
        FROM dbo.Coupons
        WHERE Code=@c AND ExpiryDate>=GETDATE()
      `);
    if (!result.recordset.length) return res.status(404).send('Invalid or expired coupon');
    res.json(result.recordset[0]);
  } catch (err) {
    console.error('Coupon error:', err.stack);
    res.status(500).send('Error applying coupon');
  }
});

// ------------- CHECKOUT & ORDERS -------------
app.post('/api/checkout', async (req, res) => {
  const { userId, items, couponId } = req.body;
  if (!userId || !Array.isArray(items) || !items.length) {
    return res.status(400).send('User ID and items are required');
  }
  const pool = await getPool();
  const tx = new sql.Transaction(pool);

  try {
    await tx.begin();
    let total = 0;
    for (const it of items) {
      const p = await tx.request()
        .input('pid', sql.Int, it.productId)
        .query(`SELECT Price FROM dbo.Products WHERE ProductID=@pid`);
      const price = p.recordset[0].Price;
      total += price * it.quantity;
      it.unitPrice = price;
    }
    if (couponId) {
      const d = await tx.request()
        .input('cid', sql.Int, couponId)
        .query(`SELECT DiscountPercent FROM dbo.Coupons WHERE CouponID=@cid`);
      total *= 1 - d.recordset[0].DiscountPercent/100;
    }

    const ord = await tx.request()
      .input('uid', sql.Int, userId)
      .input('amt', sql.Decimal(12,2), total)
      .query(`
        INSERT INTO dbo.Orders (UserID,Status,OrderDate,TotalAmount)
        VALUES (@uid,'Pending',GETDATE(),@amt);
        SELECT SCOPE_IDENTITY() AS OrderID;
      `);
    const orderId = ord.recordset[0].OrderID;

    for (const it of items) {
      await tx.request()
        .input('oid', sql.Int, orderId)
        .input('pid', sql.Int, it.productId)
        .input('qty', sql.Int, it.quantity)
        .input('up', sql.Decimal(10,2), it.unitPrice)
        .query(`
          INSERT INTO dbo.OrderItems (OrderID,ProductID,Quantity,UnitPrice)
          VALUES (@oid,@pid,@qty,@up);
        `);
    }

    await tx.request()
      .input('uid', sql.Int, userId)
      .query(`DELETE FROM dbo.CartItems WHERE UserID=@uid`);

    await tx.commit();
    res.status(201).json({ orderId });
  } catch (err) {
    await tx.rollback();
    console.error('Checkout error:', err.stack);
    res.status(500).send('Checkout failed');
  }
});

app.get('/api/orders/:userId', async (req, res) => {
  const userId = parseInt(req.params.userId, 10);
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('uid', sql.Int, userId)
      .query(`
        SELECT OrderID,Status,OrderDate,TotalAmount
        FROM dbo.Orders
        WHERE UserID=@uid
        ORDER BY OrderDate DESC
      `);
    res.json(result.recordset);
  } catch (err) {
    console.error('Fetch orders error:', err.stack);
    res.status(500).send('Error fetching orders');
  }
});

// ------------- START SERVER -------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API listening on port ${PORT}`));
