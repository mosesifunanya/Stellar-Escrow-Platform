#![no_std]

use soroban_sdk::{
    contract,
    contractevent,
    contractimpl,
    contracttype,
    token,
    Address,
    Env,
    Vec,
};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum EscrowStatus {
    Active,
    Released,
    Refunded,
    Disputed,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum MilestoneStatus {
    Pending,
    Released,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DisputeWinner {
    Worker,
    Payer,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Milestone {
    pub id: u32,
    pub amount: i128,
    pub status: MilestoneStatus,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Escrow {
    pub payer: Address,
    pub worker: Address,
    pub arbiter: Address,
    pub token: Address,
    pub amount: i128,
    pub remaining_amount: i128,
    pub deadline: u64,
    pub status: EscrowStatus,
    pub milestones: Vec<Milestone>,
}

#[contracttype]
pub enum DataKey {
    NextEscrowId,
    Escrow(u32),
}

#[contractevent]
pub struct EscrowCreated {
    #[topic]
    pub escrow_id: u32,
}

#[contractevent]
pub struct MilestoneReleased {
    #[topic]
    pub escrow_id: u32,

    #[topic]
    pub milestone_id: u32,
}

#[contractevent]
pub struct DisputeOpened {
    #[topic]
    pub escrow_id: u32,
}

#[contractevent]
pub struct DisputeResolved {
    #[topic]
    pub escrow_id: u32,
}

#[contractevent]
pub struct EscrowRefunded {
    #[topic]
    pub escrow_id: u32,
}

#[contractevent]
pub struct EscrowCancelled {
    #[topic]
    pub escrow_id: u32,
}

#[contract]
pub struct Contract;

#[contractimpl]
impl Contract {
    pub fn create_escrow(
        env: Env,
        payer: Address,
        worker: Address,
        arbiter: Address,
        token: Address,
        amount: i128,
        deadline: u64,
        milestones: Vec<Milestone>,
    ) -> u32 {
        payer.require_auth();

        if amount <= 0 {
            panic!("Amount must be greater than zero");
        }

        if milestones.is_empty() {
            panic!("Escrow must have at least one milestone");
        }

        if deadline <= env.ledger().timestamp() {
            panic!("Deadline must be in the future");
        }

        let mut milestone_total: i128 = 0;

        for milestone in milestones.iter() {
            if milestone.amount <= 0 {
                panic!("Milestone amount must be greater than zero");
            }

            milestone_total += milestone.amount;
        }

        if milestone_total != amount {
            panic!("Milestone amounts must equal escrow amount");
        }

        let token_client = token::Client::new(&env, &token);

        token_client.transfer(
            &payer,
            &env.current_contract_address(),
            &amount,
        );

        let next_id: u32 = env
            .storage()
            .instance()
            .get(&DataKey::NextEscrowId)
            .unwrap_or(0);

        let escrow_id = next_id + 1;

        let escrow = Escrow {
            payer: payer.clone(),
            worker: worker.clone(),
            arbiter: arbiter.clone(),
            token: token.clone(),
            amount,
            remaining_amount: amount,
            deadline,
            status: EscrowStatus::Active,
            milestones,
        };

        env.storage()
            .persistent()
            .set(&DataKey::Escrow(escrow_id), &escrow);

        env.storage()
            .instance()
            .set(&DataKey::NextEscrowId, &escrow_id);

        EscrowCreated {
            escrow_id,
        }
        .publish(&env);

        escrow_id
    }

    pub fn get_escrow(env: Env, escrow_id: u32) -> Escrow {
        env.storage()
            .persistent()
            .get(&DataKey::Escrow(escrow_id))
            .unwrap_or_else(|| panic!("Escrow not found"))
    }

    // Returns the ID of the most recently created escrow.
    // Returns 0 when no escrows exist.
    pub fn get_escrow_count(env: Env) -> u32 {
        env.storage()
            .instance()
            .get(&DataKey::NextEscrowId)
            .unwrap_or(0)
    }

    pub fn release_milestone(
        env: Env,
        escrow_id: u32,
        milestone_id: u32,
    ) {
        let mut escrow: Escrow = env
            .storage()
            .persistent()
            .get(&DataKey::Escrow(escrow_id))
            .unwrap_or_else(|| panic!("Escrow not found"));

        escrow.payer.require_auth();

        if escrow.status != EscrowStatus::Active {
            panic!("Escrow is not active");
        }

        let mut milestone_found = false;
        let mut milestone_amount: i128 = 0;

        for milestone in escrow.milestones.iter() {
            if milestone.id == milestone_id {
                milestone_found = true;

                if milestone.status != MilestoneStatus::Pending {
                    panic!("Milestone already released");
                }

                milestone_amount = milestone.amount;
                break;
            }
        }

        if !milestone_found {
            panic!("Milestone not found");
        }

        if milestone_amount > escrow.remaining_amount {
            panic!("Insufficient escrow balance");
        }

        let token_client =
            token::Client::new(&env, &escrow.token);

        token_client.transfer(
            &env.current_contract_address(),
            &escrow.worker,
            &milestone_amount,
        );

        escrow.remaining_amount -= milestone_amount;

        let mut updated_milestones = Vec::new(&env);
        let mut all_released = true;

        for milestone in escrow.milestones.iter() {
            if milestone.id == milestone_id {
                updated_milestones.push_back(Milestone {
                    id: milestone.id,
                    amount: milestone.amount,
                    status: MilestoneStatus::Released,
                });
            } else {
                if milestone.status != MilestoneStatus::Released {
                    all_released = false;
                }

                updated_milestones.push_back(milestone);
            }
        }

        escrow.milestones = updated_milestones;

        if all_released {
            escrow.status = EscrowStatus::Released;
        }

        env.storage()
            .persistent()
            .set(&DataKey::Escrow(escrow_id), &escrow);

        MilestoneReleased {
            escrow_id,
            milestone_id,
        }
        .publish(&env);
    }

    pub fn open_dispute(env: Env, escrow_id: u32) {
        let mut escrow: Escrow = env
            .storage()
            .persistent()
            .get(&DataKey::Escrow(escrow_id))
            .unwrap_or_else(|| panic!("Escrow not found"));

        escrow.payer.require_auth();

        if escrow.status != EscrowStatus::Active {
            panic!("Escrow is not active");
        }

        escrow.status = EscrowStatus::Disputed;

        env.storage()
            .persistent()
            .set(&DataKey::Escrow(escrow_id), &escrow);

        DisputeOpened {
            escrow_id,
        }
        .publish(&env);
    }

    pub fn resolve_dispute(
        env: Env,
        escrow_id: u32,
        winner: DisputeWinner,
    ) {
        let mut escrow: Escrow = env
            .storage()
            .persistent()
            .get(&DataKey::Escrow(escrow_id))
            .unwrap_or_else(|| panic!("Escrow not found"));

        escrow.arbiter.require_auth();

        if escrow.status != EscrowStatus::Disputed {
            panic!("Escrow is not disputed");
        }

        let amount_to_resolve = escrow.remaining_amount;

        if amount_to_resolve <= 0 {
            panic!("No remaining escrow balance");
        }

        let token_client =
            token::Client::new(&env, &escrow.token);

        match winner {
            DisputeWinner::Worker => {
                token_client.transfer(
                    &env.current_contract_address(),
                    &escrow.worker,
                    &amount_to_resolve,
                );

                escrow.remaining_amount = 0;
                escrow.status = EscrowStatus::Released;
            }

            DisputeWinner::Payer => {
                token_client.transfer(
                    &env.current_contract_address(),
                    &escrow.payer,
                    &amount_to_resolve,
                );

                escrow.remaining_amount = 0;
                escrow.status = EscrowStatus::Refunded;
            }
        }

        env.storage()
            .persistent()
            .set(&DataKey::Escrow(escrow_id), &escrow);

        DisputeResolved {
            escrow_id,
        }
        .publish(&env);
    }

    pub fn refund_escrow(env: Env, escrow_id: u32) {
        let mut escrow: Escrow = env
            .storage()
            .persistent()
            .get(&DataKey::Escrow(escrow_id))
            .unwrap_or_else(|| panic!("Escrow not found"));

        escrow.payer.require_auth();

        if escrow.status != EscrowStatus::Active {
            panic!("Escrow is not active");
        }

        if env.ledger().timestamp() < escrow.deadline {
            panic!("Deadline has not been reached");
        }

        let amount_to_refund = escrow.remaining_amount;

        if amount_to_refund <= 0 {
            panic!("No remaining escrow balance");
        }

        let token_client =
            token::Client::new(&env, &escrow.token);

        token_client.transfer(
            &env.current_contract_address(),
            &escrow.payer,
            &amount_to_refund,
        );

        escrow.remaining_amount = 0;
        escrow.status = EscrowStatus::Refunded;

        env.storage()
            .persistent()
            .set(&DataKey::Escrow(escrow_id), &escrow);

        EscrowRefunded {
            escrow_id,
        }
        .publish(&env);
    }

    pub fn cancel_escrow(env: Env, escrow_id: u32) {
        let mut escrow: Escrow = env
            .storage()
            .persistent()
            .get(&DataKey::Escrow(escrow_id))
            .unwrap_or_else(|| panic!("Escrow not found"));

        escrow.payer.require_auth();

        if escrow.status != EscrowStatus::Active {
            panic!("Escrow is not active");
        }

        let amount_to_refund = escrow.remaining_amount;

        if amount_to_refund <= 0 {
            panic!("No remaining escrow balance");
        }

        let token_client =
            token::Client::new(&env, &escrow.token);

        token_client.transfer(
            &env.current_contract_address(),
            &escrow.payer,
            &amount_to_refund,
        );

        escrow.remaining_amount = 0;
        escrow.status = EscrowStatus::Refunded;

        env.storage()
            .persistent()
            .set(&DataKey::Escrow(escrow_id), &escrow);

        EscrowCancelled {
            escrow_id,
        }
        .publish(&env);
    }
}

#[cfg(test)]
mod test;