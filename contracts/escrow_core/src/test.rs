use super::*;

use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token,
    Address,
    Env,
    Vec,
};

fn setup() -> (
    Env,
    Address,
    Address,
    Address,
    Address,
) {
    let env = Env::default();

    // Allow test accounts to authorize contract calls.
    env.mock_all_auths();

    let payer = Address::generate(&env);
    let worker = Address::generate(&env);
    let arbiter = Address::generate(&env);
    let token_admin = Address::generate(&env);

    let token_contract =
        env.register_stellar_asset_contract_v2(token_admin);

    let token_address = token_contract.address();

    let token_client =
        token::StellarAssetClient::new(&env, &token_address);

    // Give the payer 10,000 test tokens.
    token_client.mint(&payer, &10_000);

    (
        env,
        payer,
        worker,
        arbiter,
        token_address,
    )
}

fn create_milestones(env: &Env) -> Vec<Milestone> {
    Vec::from_array(
        env,
        [
            Milestone {
                id: 1,
                amount: 500,
                status: MilestoneStatus::Pending,
            },
            Milestone {
                id: 2,
                amount: 500,
                status: MilestoneStatus::Pending,
            },
        ],
    )
}

#[test]
fn test_create_escrow() {
    let (
        env,
        payer,
        worker,
        arbiter,
        token_address,
    ) = setup();

    let contract_id = env.register(Contract, ());
    let contract =
        ContractClient::new(&env, &contract_id);

    let milestones = create_milestones(&env);

    let escrow_id = contract.create_escrow(
        &payer,
        &worker,
        &arbiter,
        &token_address,
        &1_000,
        &100,
        &milestones,
    );

    assert_eq!(escrow_id, 1);

    let escrow = contract.get_escrow(&escrow_id);

    assert_eq!(escrow.payer, payer);
    assert_eq!(escrow.worker, worker);
    assert_eq!(escrow.arbiter, arbiter);
    assert_eq!(escrow.token, token_address);
    assert_eq!(escrow.amount, 1_000);
    assert_eq!(escrow.deadline, 100);
    assert_eq!(escrow.status, EscrowStatus::Active);
    assert_eq!(escrow.milestones.len(), 2);
}

#[test]
fn test_create_multiple_escrows() {
    let (
        env,
        payer,
        worker,
        arbiter,
        token_address,
    ) = setup();

    let contract_id = env.register(Contract, ());
    let contract =
        ContractClient::new(&env, &contract_id);

    let milestones_1 = Vec::from_array(
        &env,
        [Milestone {
            id: 1,
            amount: 500,
            status: MilestoneStatus::Pending,
        }],
    );

    let milestones_2 = Vec::from_array(
        &env,
        [Milestone {
            id: 1,
            amount: 500,
            status: MilestoneStatus::Pending,
        }],
    );

    let escrow_1 = contract.create_escrow(
        &payer,
        &worker,
        &arbiter,
        &token_address,
        &500,
        &100,
        &milestones_1,
    );

    let escrow_2 = contract.create_escrow(
        &payer,
        &worker,
        &arbiter,
        &token_address,
        &500,
        &200,
        &milestones_2,
    );

    assert_eq!(escrow_1, 1);
    assert_eq!(escrow_2, 2);
}

#[test]
fn test_create_and_release_milestones() {
    let (
        env,
        payer,
        worker,
        arbiter,
        token_address,
    ) = setup();

    let contract_id = env.register(Contract, ());
    let contract =
        ContractClient::new(&env, &contract_id);

    let milestones = create_milestones(&env);

    let escrow_id = contract.create_escrow(
        &payer,
        &worker,
        &arbiter,
        &token_address,
        &1_000,
        &100,
        &milestones,
    );

    contract.release_milestone(
        &escrow_id,
        &1,
    );

    let token_client =
        token::Client::new(&env, &token_address);

    assert_eq!(
        token_client.balance(&worker),
        500
    );

    let escrow = contract.get_escrow(&escrow_id);

    assert_eq!(
        escrow.milestones.get(0).unwrap().status,
        MilestoneStatus::Released
    );

    assert_eq!(
        escrow.milestones.get(1).unwrap().status,
        MilestoneStatus::Pending
    );

    contract.release_milestone(
        &escrow_id,
        &2,
    );

    assert_eq!(
        token_client.balance(&worker),
        1_000
    );

    let escrow = contract.get_escrow(&escrow_id);

    assert_eq!(
        escrow.status,
        EscrowStatus::Released
    );
}

#[test]
#[should_panic]
fn test_deadline_must_be_in_future() {
    let (
        env,
        payer,
        worker,
        arbiter,
        token_address,
    ) = setup();

    let contract_id = env.register(Contract, ());
    let contract =
        ContractClient::new(&env, &contract_id);

    let milestones = Vec::from_array(
        &env,
        [Milestone {
            id: 1,
            amount: 1_000,
            status: MilestoneStatus::Pending,
        }],
    );

    contract.create_escrow(
        &payer,
        &worker,
        &arbiter,
        &token_address,
        &1_000,
        &0,
        &milestones,
    );
}

#[test]
#[should_panic]
fn test_cannot_refund_before_deadline() {
    let (
        env,
        payer,
        worker,
        arbiter,
        token_address,
    ) = setup();

    let contract_id = env.register(Contract, ());
    let contract =
        ContractClient::new(&env, &contract_id);

    let milestones = Vec::from_array(
        &env,
        [Milestone {
            id: 1,
            amount: 1_000,
            status: MilestoneStatus::Pending,
        }],
    );

    let escrow_id = contract.create_escrow(
        &payer,
        &worker,
        &arbiter,
        &token_address,
        &1_000,
        &100,
        &milestones,
    );

    contract.refund_escrow(&escrow_id);
}

#[test]
fn test_refund_after_deadline() {
    let (
        env,
        payer,
        worker,
        arbiter,
        token_address,
    ) = setup();

    let contract_id = env.register(Contract, ());
    let contract =
        ContractClient::new(&env, &contract_id);

    let milestones = Vec::from_array(
        &env,
        [Milestone {
            id: 1,
            amount: 1_000,
            status: MilestoneStatus::Pending,
        }],
    );

    let escrow_id = contract.create_escrow(
        &payer,
        &worker,
        &arbiter,
        &token_address,
        &1_000,
        &100,
        &milestones,
    );

    env.ledger().set_timestamp(100);

    contract.refund_escrow(&escrow_id);

    let escrow = contract.get_escrow(&escrow_id);

    assert_eq!(
        escrow.status,
        EscrowStatus::Refunded
    );

    let token_client =
        token::Client::new(&env, &token_address);

    assert_eq!(
        token_client.balance(&payer),
        10_000
    );
}

#[test]
fn test_open_and_resolve_dispute_for_worker() {
    let (
        env,
        payer,
        worker,
        arbiter,
        token_address,
    ) = setup();

    let contract_id = env.register(Contract, ());
    let contract =
        ContractClient::new(&env, &contract_id);

    let milestones = Vec::from_array(
        &env,
        [Milestone {
            id: 1,
            amount: 1_000,
            status: MilestoneStatus::Pending,
        }],
    );

    let escrow_id = contract.create_escrow(
        &payer,
        &worker,
        &arbiter,
        &token_address,
        &1_000,
        &100,
        &milestones,
    );

    contract.open_dispute(&escrow_id);

    let escrow = contract.get_escrow(&escrow_id);

    assert_eq!(
        escrow.status,
        EscrowStatus::Disputed
    );

    contract.resolve_dispute(
        &escrow_id,
        &DisputeWinner::Worker,
    );

    let escrow = contract.get_escrow(&escrow_id);

    assert_eq!(
        escrow.status,
        EscrowStatus::Released
    );

    let token_client =
        token::Client::new(&env, &token_address);

    assert_eq!(
        token_client.balance(&worker),
        1_000
    );
}

#[test]
fn test_open_and_resolve_dispute_for_payer() {
    let (
        env,
        payer,
        worker,
        arbiter,
        token_address,
    ) = setup();

    let contract_id = env.register(Contract, ());
    let contract =
        ContractClient::new(&env, &contract_id);

    let milestones = Vec::from_array(
        &env,
        [Milestone {
            id: 1,
            amount: 1_000,
            status: MilestoneStatus::Pending,
        }],
    );

    let escrow_id = contract.create_escrow(
        &payer,
        &worker,
        &arbiter,
        &token_address,
        &1_000,
        &100,
        &milestones,
    );

    contract.open_dispute(&escrow_id);

    contract.resolve_dispute(
        &escrow_id,
        &DisputeWinner::Payer,
    );

    let escrow = contract.get_escrow(&escrow_id);

    assert_eq!(
        escrow.status,
        EscrowStatus::Refunded
    );

    let token_client =
        token::Client::new(&env, &token_address);

    assert_eq!(
        token_client.balance(&payer),
        10_000
    );
}

#[test]
fn test_get_escrow_count() {
    let (
        env,
        payer,
        worker,
        arbiter,
        token_address,
    ) = setup();

    let contract_id = env.register(Contract, ());
    let contract =
        ContractClient::new(&env, &contract_id);

    // No escrows yet.
    assert_eq!(
        contract.get_escrow_count(),
        0
    );

    let milestones = Vec::from_array(
        &env,
        [Milestone {
            id: 1,
            amount: 1_000,
            status: MilestoneStatus::Pending,
        }],
    );

    contract.create_escrow(
        &payer,
        &worker,
        &arbiter,
        &token_address,
        &1_000,
        &100,
        &milestones,
    );

    assert_eq!(
        contract.get_escrow_count(),
        1
    );

    contract.create_escrow(
        &payer,
        &worker,
        &arbiter,
        &token_address,
        &1_000,
        &200,
        &milestones,
    );

    assert_eq!(
        contract.get_escrow_count(),
        2
    );
}

#[test]
#[should_panic]
fn test_cannot_create_escrow_with_zero_amount() {
    let (
        env,
        payer,
        worker,
        arbiter,
        token_address,
    ) = setup();

    let contract_id = env.register(Contract, ());
    let contract =
        ContractClient::new(&env, &contract_id);

    let milestones = Vec::from_array(
        &env,
        [Milestone {
            id: 1,
            amount: 0,
            status: MilestoneStatus::Pending,
        }],
    );

    contract.create_escrow(
        &payer,
        &worker,
        &arbiter,
        &token_address,
        &0,
        &100,
        &milestones,
    );
}

#[test]
#[should_panic]
fn test_milestone_total_must_equal_escrow_amount() {
    let (
        env,
        payer,
        worker,
        arbiter,
        token_address,
    ) = setup();

    let contract_id = env.register(Contract, ());
    let contract =
        ContractClient::new(&env, &contract_id);

    let milestones = Vec::from_array(
        &env,
        [Milestone {
            id: 1,
            amount: 500,
            status: MilestoneStatus::Pending,
        }],
    );

    contract.create_escrow(
        &payer,
        &worker,
        &arbiter,
        &token_address,
        &1_000,
        &100,
        &milestones,
    );
}

#[test]
#[should_panic]
fn test_cannot_release_same_milestone_twice() {
    let (
        env,
        payer,
        worker,
        arbiter,
        token_address,
    ) = setup();

    let contract_id = env.register(Contract, ());
    let contract =
        ContractClient::new(&env, &contract_id);

    let milestones = Vec::from_array(
        &env,
        [Milestone {
            id: 1,
            amount: 1_000,
            status: MilestoneStatus::Pending,
        }],
    );

    let escrow_id = contract.create_escrow(
        &payer,
        &worker,
        &arbiter,
        &token_address,
        &1_000,
        &100,
        &milestones,
    );

    contract.release_milestone(
        &escrow_id,
        &1,
    );

    // This should fail because milestone 1
    // has already been released.
    contract.release_milestone(
        &escrow_id,
        &1,
    );
}

#[test]
#[should_panic]
fn test_cannot_refund_completed_escrow() {
    let (
        env,
        payer,
        worker,
        arbiter,
        token_address,
    ) = setup();

    let contract_id = env.register(Contract, ());
    let contract =
        ContractClient::new(&env, &contract_id);

    let milestones = Vec::from_array(
        &env,
        [Milestone {
            id: 1,
            amount: 1_000,
            status: MilestoneStatus::Pending,
        }],
    );

    let escrow_id = contract.create_escrow(
        &payer,
        &worker,
        &arbiter,
        &token_address,
        &1_000,
        &100,
        &milestones,
    );

    contract.release_milestone(
        &escrow_id,
        &1,
    );

    // The escrow is already completed.
    // Refund should fail.
    contract.refund_escrow(&escrow_id);
}

#[test]
#[should_panic]
fn test_cannot_open_dispute_on_completed_escrow() {
    let (
        env,
        payer,
        worker,
        arbiter,
        token_address,
    ) = setup();

    let contract_id = env.register(Contract, ());
    let contract =
        ContractClient::new(&env, &contract_id);

    let milestones = Vec::from_array(
        &env,
        [Milestone {
            id: 1,
            amount: 1_000,
            status: MilestoneStatus::Pending,
        }],
    );

    let escrow_id = contract.create_escrow(
        &payer,
        &worker,
        &arbiter,
        &token_address,
        &1_000,
        &100,
        &milestones,
    );

    contract.release_milestone(
        &escrow_id,
        &1,
    );

    // The escrow is already completed.
    // Opening a dispute should fail.
    contract.open_dispute(&escrow_id);
}

#[test]
fn test_cancel_escrow() {
    let (
        env,
        payer,
        worker,
        arbiter,
        token_address,
    ) = setup();

    let contract_id = env.register(Contract, ());
    let contract =
        ContractClient::new(&env, &contract_id);

    let milestones = Vec::from_array(
        &env,
        [Milestone {
            id: 1,
            amount: 1_000,
            status: MilestoneStatus::Pending,
        }],
    );

    let escrow_id = contract.create_escrow(
        &payer,
        &worker,
        &arbiter,
        &token_address,
        &1_000,
        &100,
        &milestones,
    );

    // Cancel the active escrow.
    contract.cancel_escrow(&escrow_id);

    let escrow = contract.get_escrow(&escrow_id);

    // The escrow should now be refunded.
    assert_eq!(
        escrow.status,
        EscrowStatus::Refunded
    );

    // Payer should receive the money back.
    let token_client =
        token::Client::new(&env, &token_address);

    assert_eq!(
        token_client.balance(&payer),
        10_000
    );
}