-- Invented scores the Worker and browser tests load on top of the migrations, one board per case they check.
INSERT INTO scores (mode, name, score, level, created_at, device_id) VALUES
	('classic', 'Alice & Bob', 1626, 9, 1794196099849, 'fixture'),
	('classic', 'Alice', 1506, 8, 1794195338534, 'fixture'),
	('spot', 'Alice & Bob', 1009, 6, 1794196251465, 'fixture'),
	('lineup', 'Alice & Bob', 1185, 7, 1794195933598, 'fixture');
