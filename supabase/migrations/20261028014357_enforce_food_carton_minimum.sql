-- Enforce the existing food-order rule without rewriting customer/product records.
do $minimum$
declare definition text;
begin
  definition := pg_get_functiondef('hamiya_private.dispatch(text,jsonb)'::regprocedure);
  if position('quantity not between 20 and 10000 then' in definition) > 0 then return; end if;
  if position('quantity not between 1 and 10000 then' in definition) = 0 then
    raise exception 'Unexpected HAMIYA order validator; manual review required';
  end if;
  execute replace(definition, 'quantity not between 1 and 10000 then', 'quantity not between 20 and 10000 then');
end
$minimum$;
