CREATE TYPE public.app_role AS ENUM ('admin');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own roles readable" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- First account to sign up becomes the business owner (admin)
CREATE OR REPLACE FUNCTION public.handle_first_admin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created_admin AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_first_admin();

CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL DEFAULT 'General',
  price numeric NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT 'per piece',
  details text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.agent_settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  business_name text NOT NULL DEFAULT 'K&S Solar Energy',
  instructions text NOT NULL DEFAULT '',
  agent_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id text NOT NULL UNIQUE,
  name text NOT NULL DEFAULT '',
  ai_paused boolean NOT NULL DEFAULT false,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('client','agent','owner')),
  content text NOT NULL,
  external_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX messages_external_id_key ON public.messages(external_id) WHERE external_id IS NOT NULL;
CREATE INDEX messages_contact_idx ON public.messages(contact_id, created_at);

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['products','agent_settings','contacts','messages'] LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "admin all" ON public.%I FOR ALL TO authenticated USING (public.has_role(auth.uid(), ''admin'')) WITH CHECK (public.has_role(auth.uid(), ''admin''))', t);
  END LOOP;
END $$;

ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.contacts;

INSERT INTO public.agent_settings (id, business_name, instructions) VALUES (1, 'K&S Solar Energy',
'Hum K&S Solar Energy hain — solar system installation aur solar products ki EPC company. Clients ko friendly aur professional tareeqe se guide karo. Pehle client ki zaroorat samjho (ghar ya business, monthly bill, kitne units, kaunsa sheher), phir sahi system suggest karo. Site survey free hai. Final quotation survey ke baad di jati hai.');

INSERT INTO public.products (name, category, price, unit, details) VALUES
('3 kW On-Grid Solar System', 'Complete Systems', 450000, 'per system', 'Demo rate. Chhote ghar ke liye, roz takreeban 12-15 units. Panels, inverter, structure aur installation shamil.'),
('5 kW Hybrid Solar System', 'Complete Systems', 750000, 'per system', 'Demo rate. Battery backup ke sath, 20-25 units roz. Net metering ready.'),
('10 kW On-Grid Solar System', 'Complete Systems', 1350000, 'per system', 'Demo rate. Bade ghar / dukaan ke liye, 40-45 units roz.'),
('585W Mono PERC Solar Panel', 'Panels', 28000, 'per panel', 'Demo rate. Tier-1 brand, 25 saal performance warranty.'),
('6 kW Hybrid Inverter', 'Inverters', 285000, 'per piece', 'Demo rate. WiFi monitoring, 5 saal warranty.'),
('5 kWh Lithium Battery', 'Batteries', 340000, 'per piece', 'Demo rate. 6000 cycles, 10 saal life.'),
('Net Metering Service', 'Services', 85000, 'per application', 'Demo rate. Poori file aur approval process hum karte hain.');