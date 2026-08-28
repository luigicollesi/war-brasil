-- Valida o catálogo histórico já existente sem bloquear um banco novo ainda
-- vazio. A aplicação usa o mesmo contrato em src/lib/events/event-catalog.ts.
DO $$
DECLARE
  event_count INTEGER;
  connection_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO event_count FROM events;

  IF event_count = 0 THEN
    RETURN;
  END IF;

  IF event_count <> 38 OR
     (SELECT COUNT(*) FROM events WHERE id BETWEEN 0 AND 37) <> 38 THEN
    RAISE EXCEPTION
      'Catálogo de eventos inválido: esperado conjunto exato de IDs 0 a 37.';
  END IF;

  SELECT COUNT(*) INTO connection_count FROM event_connections;
  IF connection_count <> 195 THEN
    RAISE EXCEPTION
      'Grafo de eventos inválido: esperadas 195 conexões, encontradas %.',
      connection_count;
  END IF;

  IF (SELECT COUNT(*) FROM event_connections WHERE from_event = 0) <> 10 OR
     EXISTS (
       SELECT 1
       FROM event_connections
       WHERE from_event = 0 AND weight <> 1
     ) THEN
    RAISE EXCEPTION
      'Evento 0 precisa possuir 10 conexões de saída, todas com peso 1.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM events event_row
    WHERE event_row.id BETWEEN 1 AND 37
      AND (
        SELECT COUNT(*)
        FROM event_connections connection_row
        WHERE connection_row.from_event = event_row.id
      ) <> 5
  ) THEN
    RAISE EXCEPTION
      'Cada evento de 1 a 37 precisa possuir exatamente 5 conexões de saída.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM event_connections
    WHERE from_event <> 0 AND weight NOT IN (1, 2, 4)
  ) THEN
    RAISE EXCEPTION
      'Eventos 1 a 37 só podem usar pesos 1, 2 ou 4.';
  END IF;
END
$$;
